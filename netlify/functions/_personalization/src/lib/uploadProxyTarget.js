import { checkDestination, isBlockedHostname, isIpLiteral, createPinnedFetch, isBlockedIpAddress, pickPinnedAddress } from './networkSafety';

// NOTE: isBlockedFileType() is a denylist used by the DIRECT upload route
// (app/api/v1/upload_file/route.ts) as defence-in-depth on top of the MIME
// allowlist. The legacy /api/*\/upload-binary S3 proxy routes do NOT call it —
// they enforce their own copy of the allowlist. validateUploadProxyTarget() is
// likewise only used by those legacy proxies; the direct route posts to a
// hardcoded upstream URL, so SSRF is not applicable to it.
//
// Every IP / hostname / DNS-rebinding rule now lives in the single shared
// module ./networkSafety, so the upload proxy cannot drift away from the
// discovery path. This file owns only the S3 destination allowlist and the
// upload-specific file rules.

const DEFAULT_S3_REGION_PATTERN = /^[a-z0-9-]+$/;

function normalizeHostname(hostname) {
    return hostname.toLowerCase().replace(/\.$/, '');
}

function parseAllowedHosts(env) {
    return (env.UPLOAD_PROXY_ALLOWED_HOSTS || '')
        .split(',')
        .map((host) => normalizeHostname(host.trim()))
        .filter(Boolean);
}

function isBlockedHost(hostname) {
    const normalized = normalizeHostname(hostname).replace(/^\[|\]$/g, '');

    return isBlockedHostname(normalized) || isIpLiteral(normalized);
}

function isAllowedS3Host(hostname, allowedHosts = []) {
    // Reject empty labels (leading dot, trailing dot, or consecutive dots).
    if (hostname.split('.').some((label) => label === '')) {
        return false;
    }

    // Allow exact matches from UPLOAD_PROXY_ALLOWED_HOSTS
    if (allowedHosts.includes(hostname)) {
        return true;
    }

    // Exact S3 endpoint shapes (bucket names permit a single character):
    //   bucket.s3.amazonaws.com                       global
    //   bucket.s3-<region>.amazonaws.com              regional
    //   bucket.s3.<region>.amazonaws.com              regional / dualstack
    //   bucket.s3.<region>.dualstack.amazonaws.com    dualstack tail
    //   bucket.s3.dualstack.<region>.amazonaws.com    dualstack prefix
    // Anchored at both ends so a lookalike host (e.g. s3.amazonaws.com.evil.tld)
    // cannot match.
    if (/^[a-z0-9](?:[a-z0-9.\-]*[a-z0-9])?\.s3(?:[.-][a-z0-9-]+){0,4}\.amazonaws\.com$/.test(hostname)) {
        return true;
    }

    return false;
}

export function getApiKeyFromRequest(request) {
    if (!request || !request.headers) return null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token) return token;
    }
    const headerKey = request.headers.get('x-api-key');
    if (headerKey && headerKey.trim()) {
        return headerKey.trim();
    }
    return null;
}

const BLOCKED_EXTENSIONS = new Set([
    'html', 'htm', 'xhtml', 'svg', 'php', 'phtml', 'php3', 'php4', 'php5', 'phps',
    'exe', 'bat', 'cmd', 'sh', 'bash', 'js', 'cgi', 'pl', 'py', 'jar', 'vbs', 'scr', 'msi'
]);

const BLOCKED_MIME_TYPES = new Set([
    'text/html',
    'image/svg+xml',
    'application/xhtml+xml',
    'application/x-httpd-php',
    'application/x-msdownload',
    'application/x-executable',
    'application/x-sh',
    'application/x-shellscript',
    'application/javascript',
    'text/javascript'
]);

export function isBlockedFileType(filename = '', contentType = '') {
    if (contentType) {
        const normalizedMime = contentType.toLowerCase().split(';')[0].trim();
        if (BLOCKED_MIME_TYPES.has(normalizedMime)) {
            return true;
        }
    }
    if (filename) {
        const parts = filename.toLowerCase().split('.');
        if (parts.length > 1) {
            const ext = parts[parts.length - 1].trim();
            if (BLOCKED_EXTENSIONS.has(ext)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Validates an upload/proxy destination.
 *
 * Order of the gates:
 *   1. protocol must be https
 *   2. hostname must not be a private/reserved literal or a local name
 *   3. hostname must be on the S3 allowlist
 *   4. EVERY address the hostname currently resolves to must be public
 *      (this is what closes the DNS-rebinding / resolves-to-private-IP hole)
 *
 * Returns `{ ok: true, url, hostname, addresses, pinnedAddress, pinnedFetch }`
 * on success. Callers MUST perform the upload through `pinnedFetch(url, init)`
 * instead of the platform `fetch`: a plain `fetch(url)` re-resolves DNS between
 * this check and the connect, which reopens the DNS-rebinding window the check
 * just closed. `pinnedFetch` is fetch-compatible (same `(url, init)` shape,
 * returns a `Response`) but binds the connection to `pinnedAddress`, keeps TLS
 * verifying the hostname, and never follows a redirect.
 */
export async function validateUploadProxyTarget(rawTarget, { env = process.env } = {}) {
    if (typeof rawTarget !== 'string' || rawTarget.trim() === '') {
        return { ok: false, reason: 'missing_target' };
    }

    let url;
    try {
        url = new URL(rawTarget);
    } catch {
        return { ok: false, reason: 'invalid_url' };
    }

    if (url.protocol !== 'https:') {
        return { ok: false, reason: 'unsafe_protocol' };
    }

    const hostname = normalizeHostname(url.hostname);
    if (isBlockedHost(hostname)) {
        return { ok: false, reason: 'host_not_allowed' };
    }

    const allowedHosts = parseAllowedHosts(env);
    if (!isAllowedS3Host(hostname, allowedHosts)) {
        return { ok: false, reason: 'host_not_allowed' };
    }

    // Resolve + validate every address. checkDestination re-runs the hostname
    // gates, resolves A *and* AAAA records and rejects the destination if any
    // resolved address is private/loopback/link-local/CGNAT/IPv4-mapped.
    const destination = await checkDestination(url.toString());
    if (!destination.ok) {
        // A name that does not resolve is not a rebinding, it is a typo or a
        // dangling record; report it distinctly from a blocked address.
        const reason =
            destination.reason === 'invalid_url' ? 'invalid_url' : destination.reason;
        return { ok: false, reason };
    }

    const validated = {
        ok: true,
        url: destination.url,
        hostname,
        addresses: destination.addresses,
    };

    const pinnedAddress = pickPinnedAddress({ hostname, addresses: destination.addresses });
    return {
        ...validated,
        pinnedAddress,
        pinnedFetch: createUploadProxyPinnedFetch(validated, pinnedAddress),
    };
}

/** True when a FormData value is a file/blob part rather than a plain field. */
function isFilePartValue(value) {
    return Boolean(value) && typeof value === 'object' && typeof value.arrayBuffer === 'function';
}

function escapeMultipartToken(value) {
    return String(value).replace(/[\r\n"]/g, (character) =>
        character === '"' ? '%22' : `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
    );
}

/**
 * Serializes the S3 POST form into a multipart body.
 *
 * S3 requires the file field to be the LAST field of the form, so file parts
 * are moved after every plain field regardless of insertion order. The
 * `content-type` of each part is preserved so S3 stores the object under the
 * type the uploader asked for.
 *
 * Exported so the encoding can be asserted directly; production callers use it
 * through `createUploadProxyPinnedFetch`.
 */
export async function encodeS3FormData(formData) {
    const fieldParts = [];
    const fileParts = [];

    for (const [key, value] of formData.entries()) {
        if (isFilePartValue(value)) {
            fileParts.push([key, value]);
        } else {
            fieldParts.push([key, value]);
        }
    }

    const boundary = `----openhiggsbolt-upload-proxy-${randomBoundaryToken()}`;
    const chunks = [];

    const pushPart = (headers, payload) => {
        chunks.push(Buffer.from(`--${boundary}\r\n${headers}\r\n\r\n`));
        chunks.push(payload);
        chunks.push(Buffer.from('\r\n'));
    };

    for (const [key, value] of fieldParts) {
        pushPart(
            `Content-Disposition: form-data; name="${escapeMultipartToken(key)}"`,
            Buffer.from(String(value)),
        );
    }

    for (const [key, value] of fileParts) {
        const filename = escapeMultipartToken(value.name || 'file');
        const partHeaders =
            `Content-Disposition: form-data; name="${escapeMultipartToken(key)}"; filename="${filename}"\r\n` +
            `Content-Type: ${value.type || 'application/octet-stream'}`;
        pushPart(partHeaders, Buffer.from(await value.arrayBuffer()));
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`));

    return {
        body: Buffer.concat(chunks),
        contentType: `multipart/form-data; boundary=${boundary}`,
    };
}

function randomBoundaryToken() {
    try {
        const bytes = new Uint8Array(12);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch {
        return Math.random().toString(16).slice(2).padEnd(24, '0');
    }
}

/**
 * Wraps the networkSafety pin into a fetch-compatible upload call.
 *
 * Defence in depth on top of `validateUploadProxyTarget`: the pin that this
 * fetch would connect to must still be a public address, and the caller may
 * only request the exact host that was validated.
 */
export function createUploadProxyPinnedFetch(validatedTarget, pinnedAddress) {
    if (!validatedTarget || validatedTarget.ok !== true || !validatedTarget.url) {
        throw new Error('createUploadProxyPinnedFetch requires a validated upload target');
    }

    const pin = pinnedAddress || pickPinnedAddress(validatedTarget);
    if (!pin || isBlockedIpAddress(pin)) {
        throw new Error('networkSafety: upload proxy refused a non-public pin address');
    }

    const pinnedFetch = createPinnedFetch({
        url: validatedTarget.url,
        hostname: validatedTarget.hostname,
        addresses: validatedTarget.addresses,
    });

    return async function uploadProxyPinnedFetch(requestUrl, init = {}) {
        let body = init.body;
        const headers = { ...(init.headers || {}) };

        if (
            body &&
            typeof body === 'object' &&
            typeof body.entries === 'function' &&
            typeof FormData !== 'undefined' &&
            body instanceof FormData
        ) {
            const encoded = await encodeS3FormData(body);
            body = encoded.body;
            if (!headers['content-type'] && !headers['Content-Type']) {
                headers['content-type'] = encoded.contentType;
            }
        }

        return pinnedFetch(requestUrl, { ...init, body, headers });
    };
}

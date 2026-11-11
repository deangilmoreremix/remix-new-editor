import { NextRequest, NextResponse } from '../../../../shims/next-server';
import { safeApiJson, upstreamErrorResponse } from '../../../../src/lib/safeApiResponse';
import { getApiKeyFromRequest, isBlockedFileType } from '../../../../src/lib/uploadProxyTarget.js';
import { getUploadLimit, isAllowedUploadMimeType, formatUploadLimit, ALLOWED_UPLOAD_MIME_TYPES } from '../../../../src/lib/uploadConfig';
import { auth } from '../../../../shims/clerk-server';

const MUAPI_UPLOAD_URL = 'https://api.muapi.ai/api/v1/upload_file';

// Size limits and the MIME allowlist are imported from the single authoritative
// upload contract (packages/studio/src/uploadContract.js). Never re-declare
// them here — that is how this route previously drifted from the clients.
// Mirrors https://muapi.ai/docs/file-upload:
//   Images 10MB .jpg .png .webp | Videos 50MB .mp4 .mov | Others 10MB .zip .pdf .json

// This route is the retry authority for uploads: the browser sends exactly one
// request and waits longer than this worst case (see the client's policy in
// packages/studio/src/muapi.js). Keep the client budget in sync if changed:
//   worst case = UPLOAD_MAX_RETRIES * UPLOAD_ATTEMPT_TIMEOUT_MS + backoff
const UPLOAD_ATTEMPT_TIMEOUT_MS = 120_000;

// ── Structured failure classification ────────────────────────────────────────
// Every upload failure returns a machine-readable `code` plus a human message.
// The client can branch on `code` without parsing prose; logs get the diagnostic
// detail. NEVER log or return the api key, the raw upstream body, or the user's
// original filename (file metadata can itself be sensitive).

export type UploadFailureCode =
  | 'REJECTED_MULTIPART'
  | 'REJECTED_NO_FILE'
  | 'REJECTED_MIME_TYPE'
  | 'REJECTED_BLOCKED_TYPE'
  | 'REJECTED_TOO_LARGE'
  | 'UNAUTHENTICATED'
  | 'UPSTREAM_UNREACHABLE'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_REJECTED'
  | 'UPSTREAM_NO_URL'
  | 'INTERNAL';

function fail(code: UploadFailureCode, message: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Extension only — never the full filename. */
function safeExtension(file: File): string {
  const dot = file.name.lastIndexOf('.');
  return dot === -1 ? '(none)' : file.name.slice(dot + 1).toLowerCase().slice(0, 12);
}

/**
 * Server-side diagnostic line. Deliberately excludes the api key, the upstream
 * response body, and the user's filename.
 */
function logUploadFailure(code: UploadFailureCode, detail: Record<string, unknown>) {
  console.warn(`[upload_file] ${code}`, JSON.stringify(detail));
}

const UPLOAD_MAX_RETRIES = 3;
const UPLOAD_BASE_DELAY_MS = 1_000;

// ── Durable storage ─────────────────────────────────────────────────────────
// MuAPI upload URLs expire after one hour, so the URL this route returns is
// TEMPORARY by construction and must never be an asset's permanent
// identifier. The permanent identifier is a Supabase Storage object under a
// workspace-scoped prefix, and the way to get a fresh MuAPI URL after an hour
// is to re-upload that object from here.
//
// This is also what makes a 50 MB video survivable: Netlify Functions cap a
// buffered function request payload at 6 MB (binary bodies are Base64-encoded,
// so ~4.5 MB in practice). A file that large is written straight to storage by
// the browser, and this route re-uploads it storage → MuAPI, so the only thing
// that crosses the function boundary is an asset id.
const DURABLE_BUCKET = 'personalization-assets';
const ASSET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

// Workspace used for unauthenticated demo uploads. Scoped to a fixed prefix so
// unauthenticated users cannot access another user's durable assets.
const DEMO_WORKSPACE_ID = 'demo-uploads';

function sanitizeSegment(value: string, fallback = 'x'): string {
  const cleaned = String(value)
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 96);
  return cleaned || fallback;
}

function durableObjectPath(workspaceId: string, assetId: string, name: string): string {
  // Workspace first: the object path itself carries the authorization scope,
  // so a read for another workspace's asset resolves to a different prefix.
  return `${sanitizeSegment(workspaceId)}/${sanitizeSegment(assetId)}/${sanitizeSegment(name, 'file')}`;
}

/**
 * The caller's AUTHORIZED workspace, taken from the verified session and
 * never from anything in the request. Returns a demo workspace ID when there
 * is no session, so unauthenticated demo uploads are scoped to a fixed prefix
 * and cannot access another user's durable assets.
 */
async function resolveAuthorizedWorkspace(): Promise<string> {
  try {
    const { userId } = await auth();
    // remix: the browser adapter writes durable originals under
    // getStableUserId() = `smartvideo-go:clerk:<id>` (sanitised to
    // `smartvideo-go-clerk-<id>`), which is also the folder the owner-scoped
    // `personalization-assets` storage policy allows. Use the same workspace
    // here so both sides of a >4.5 MB upload find the same object.
    if (userId) return `smartvideo-go:clerk:${userId}`;
  } catch {
    // Fall through to demo workspace below
  }
  return DEMO_WORKSPACE_ID;
}

async function createDurableStorageClient() {
  const { createServerClient } = await import('../../../../src/lib/supabase');
  return createServerClient();
}

/** Durably store an original under the caller's workspace prefix. */
async function storeDurableOriginal(params: {
  workspaceId: string;
  assetId: string;
  file: File;
}): Promise<{ durableRef: string; durableUrl: string | null }> {
  const durableRef = durableObjectPath(params.workspaceId, params.assetId, params.file.name);
  const storage = (await createDurableStorageClient()).storage.from(DURABLE_BUCKET);
  const { error } = await storage.upload(durableRef, params.file, {
    upsert: true,
    contentType: params.file.type || 'application/octet-stream',
  });
  if (error) {
    throw new Error(`durable storage upload failed: ${error.message}`);
  }
  const { data } = storage.getPublicUrl(durableRef);
  return { durableRef, durableUrl: data?.publicUrl ?? null };
}

/**
 * Locate the durable original stored for one asset inside the caller's
 * workspace prefix.
 *
 * The workspace prefix is built from the SESSION workspace, never from the
 * request, so looking up an asset that lives in another workspace resolves to
 * a different prefix and simply finds nothing — indistinguishable from an
 * asset that does not exist. The object's own filename is discovered by
 * listing the prefix, so a caller cannot request an arbitrary path.
 */
async function findDurableOriginal(
  workspaceId: string,
  assetId: string,
): Promise<{ objectPath: string; name: string; size: number } | null> {
  const prefix = `${sanitizeSegment(workspaceId)}/${sanitizeSegment(assetId)}`;
  const storage = (await createDurableStorageClient()).storage.from(DURABLE_BUCKET);
  const { data, error } = await storage.list(prefix, {
    limit: 20,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) {
    throw new Error(`durable storage list failed: ${error.message}`);
  }
  const entries = (Array.isArray(data) ? data : []) as Array<{
    name?: unknown;
    metadata?: { size?: unknown } | null;
  }>;
  const entry = entries.find(
    (candidate) => typeof candidate?.name === 'string' && candidate.name.length > 0,
  );
  if (!entry) return null;
  return {
    objectPath: `${prefix}/${String(entry.name)}`,
    name: String(entry.name),
    size: Number(entry.metadata?.size ?? 0),
  };
}

async function attemptMuApiUpload(apiKey: string, formData: FormData): Promise<Response> {
  return fetch(MUAPI_UPLOAD_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: formData,
    signal: AbortSignal.timeout(UPLOAD_ATTEMPT_TIMEOUT_MS),
  });
}

async function uploadWithRetry(apiKey: string, formData: FormData): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < UPLOAD_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with a small deterministic jitter, capped so the
      // total added delay stays bounded.
      const delay = Math.min(UPLOAD_BASE_DELAY_MS * 2 ** (attempt - 1), 8000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const response = await attemptMuApiUpload(apiKey, formData);
      if (response.ok) return response;
      
      // Don't retry on client errors (4xx) except 429
      const status = response.status;
      if (status >= 400 && status < 500 && status !== 429) {
        return response;
      }
      
      // For 5xx and 429, we'll retry
      const text = await response.text().catch(() => '');
      lastError = new Error(`MuAPI upload failed with status ${status}: ${text}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Network error during upload');
    }
  }
  
  throw lastError || new Error('MuAPI upload failed after retries');
}

/** Forward an upstream upload response, translating its body into ours. */
async function forwardMuAPIResponse(response: Response): Promise<NextResponse> {
  const parsed = await safeApiJson(response);

  if (response.ok) {
    const url = typeof parsed === 'object' && parsed !== null
      ? (parsed as any).url || (parsed as any).file_url || (parsed as any).data?.url
      : undefined;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'No URL returned from file upload' }, { status: 502 });
    }

    return NextResponse.json({
      url,
      name: (parsed as any)?.name,
      size: (parsed as any)?.size,
      type: (parsed as any)?.type,
    });
  }

  return upstreamErrorResponse(response, parsed);
}

/**
 * `GET /api/v1/upload_file?durable_asset_id=<id>`
 *
 * Durable-record lookup, scoped to the session workspace. A caller asking for
 * another workspace's asset gets an indistinguishable 404, never a leak.
 */
async function handleDurableRecordRequest(request: NextRequest): Promise<NextResponse> {
  const workspaceId = await resolveAuthorizedWorkspace();

  const assetId = new URL(request.url).searchParams.get('durable_asset_id') || '';
  if (!ASSET_ID_PATTERN.test(assetId)) {
    return NextResponse.json({ error: 'Invalid durable asset id' }, { status: 400 });
  }

  const found = await findDurableOriginal(workspaceId, assetId);
  if (!found) {
    return NextResponse.json({ error: 'Durable asset not found' }, { status: 404 });
  }

  const storage = (await createDurableStorageClient()).storage.from(DURABLE_BUCKET);
  const { data: publicUrl } = storage.getPublicUrl(found.objectPath);

  return NextResponse.json({
    assetId,
    workspaceId,
    durableRef: found.objectPath,
    durableUrl: publicUrl?.publicUrl ?? null,
    name: found.name,
    size: found.size,
  });
}

/**
 * `POST /api/v1/upload_file?durable=resolve` with a JSON `{ durable_asset_id }`.
 *
 * Re-uploads the DURABLE ORIGINAL to MuAPI and returns a fresh temporary URL.
 * This is the only sanctioned way to obtain a new URL once the previous one has
 * passed its one-hour lifetime: the bytes come from authorized storage, so the
 * request body stays a few hundred bytes even for a 50 MB video.
 */
async function handleDurableResolveRequest(request: NextRequest): Promise<NextResponse> {
  const workspaceId = await resolveAuthorizedWorkspace();

  let assetId = '';
  try {
    const payload = await request.json();
    assetId = String(payload?.durable_asset_id ?? payload?.durable_assetId ?? '');
  } catch {
    return NextResponse.json({ error: 'Request must be JSON' }, { status: 400 });
  }

  if (!ASSET_ID_PATTERN.test(assetId)) {
    return NextResponse.json({ error: 'Invalid durable asset id' }, { status: 400 });
  }

  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized: Missing API key' }, { status: 401 });
  }

  let original: File | null = null;
  let durableRef = '';
  try {
    const found = await findDurableOriginal(workspaceId, assetId);
    if (found) {
      durableRef = found.objectPath;
      const storage = (await createDurableStorageClient()).storage.from(DURABLE_BUCKET);
      const downloaded = await storage.download(found.objectPath);
      if (!downloaded.error && downloaded.data) {
        original = new File([downloaded.data], found.name, {
          type: downloaded.data.type || 'application/octet-stream',
        });
      }
    }
  } catch (error) {
    console.error('Durable original load failed:', error);
    return NextResponse.json(
      { error: 'Unable to load the stored original. Please upload the file again.' },
      { status: 502 },
    );
  }

  if (!original) {
    return NextResponse.json(
      { error: 'Durable asset not found in this workspace' },
      { status: 404 },
    );
  }

  const uploadForm = new FormData();
  uploadForm.append('file', original);

  let response: Response;
  try {
    response = await uploadWithRetry(apiKey, uploadForm);
  } catch (error) {
    return muAPIUnavailableResponse(error);
  }

  const parsed = await safeApiJson(response);
  if (response.ok) {
    const url = typeof parsed === 'object' && parsed !== null
      ? (parsed as any).url || (parsed as any).file_url || (parsed as any).data?.url
      : undefined;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'No URL returned from file upload' }, { status: 502 });
    }

    return NextResponse.json({
      url,
      name: original.name,
      size: original.size,
      type: original.type,
      source: 'durable',
      durableRef,
      uploadedAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
  }

  return upstreamErrorResponse(response, parsed);
}

/** Map an upstream upload failure onto a safe, non-echoing response. */
function muAPIUnavailableResponse(error: unknown): NextResponse {
  console.error('MuAPI upload failed after retries:', error);

  const message = error instanceof Error ? error.message : '';

  if (error instanceof TypeError) {
    return NextResponse.json(
      { error: 'MuAPI upload failed. Unable to reach MuAPI. Please check your connection and try again.', code: 'UPSTREAM_UNREACHABLE' },
      { status: 502 }
    );
  }

  if (/MuAPI upload failed with status 4\d\d/.test(message)) {
    return NextResponse.json(
      { error: 'MuAPI upload failed. MuAPI rejected the upload. Please try again.', code: 'UPSTREAM_REJECTED' },
      { status: 502 }
    );
  }

  if (/MuAPI upload failed with status 5\d\d/.test(message)) {
    return NextResponse.json(
      { error: 'MuAPI upload failed. MuAPI is temporarily unavailable. Please try again in a moment.', code: 'UPSTREAM_UNAVAILABLE' },
      { status: 502 }
    );
  }

  // Never echo `message` back: the retry layer embeds the raw upstream body
  // in the Error text, and that body can contain upstream identifiers.
  // The exact cause is logged server-side for debugging instead.
  return NextResponse.json(
    { error: 'MuAPI upload failed. Please try again.', code: 'UPSTREAM_FAILED' },
    { status: 502 }
  );
}

export async function GET(request: NextRequest) {
  try {
    if (!new URL(request.url).searchParams.has('durable_asset_id')) {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }
    return await handleDurableRecordRequest(request);
  } catch (error) {
    console.error('Upload file exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // The durable-resolve hop is the only body-light path; it is a JSON request
  // so a plain multipart POST keeps its existing contract untouched.
  if (new URL(request.url).searchParams.get('durable') === 'resolve') {
    try {
      return await handleDurableResolveRequest(request);
    } catch (error) {
      console.error('Upload file exception:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      logUploadFailure('REJECTED_MULTIPART', { contentType: contentType.slice(0, 80) });
      return fail('REJECTED_MULTIPART', 'Request must be multipart/form-data', 400);
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      logUploadFailure('REJECTED_NO_FILE', { formFields: [...formData.keys()].slice(0, 20) });
      return fail('REJECTED_NO_FILE', 'file is required', 400);
    }

    if (!isAllowedUploadMimeType(file)) {
      logUploadFailure('REJECTED_MIME_TYPE', { mime: file.type || '(empty)', ext: safeExtension(file), bytes: file.size });
      return fail(
        'REJECTED_MIME_TYPE',
        `Invalid file type: ${file.type || 'unknown'}. Allowed: ${[...ALLOWED_UPLOAD_MIME_TYPES].join(', ')}`,
        400
      );
    }

    if (isBlockedFileType(file.name, file.type)) {
      logUploadFailure('REJECTED_BLOCKED_TYPE', { ext: safeExtension(file), mime: file.type || '(empty)' });
      return fail('REJECTED_BLOCKED_TYPE', 'File type is not permitted', 400);
    }

    const maxBytes = getUploadLimit(file);
    if (file.size > maxBytes) {
      logUploadFailure('REJECTED_TOO_LARGE', { bytes: file.size, limit: maxBytes, mime: file.type || '(empty)' });
      return fail(
        'REJECTED_TOO_LARGE',
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum: ${formatUploadLimit(maxBytes)}`,
        400
      );
    }

    const apiKey = getApiKeyFromRequest(request);
    if (!apiKey) {
      logUploadFailure('UNAUTHENTICATED', { reason: 'missing_api_key' });
      return fail('UNAUTHENTICATED', 'Unauthorized: Missing API key', 401);
    }

    // Optional durable mirror: the original is written to authorized storage
    // BEFORE it is forwarded to MuAPI, so the asset's permanent identifier is
    // a durable reference even on the small-file path. The workspace comes
    // from the session, never from the request.
    const durableAssetId = typeof formData.get('durable_asset_id') === 'string'
      ? String(formData.get('durable_asset_id'))
      : '';
    let durableRef: string | null = null;
    let durableUrl: string | null = null;

    if (durableAssetId && ASSET_ID_PATTERN.test(durableAssetId)) {
      const workspaceId = await resolveAuthorizedWorkspace();
      try {
        const stored = await storeDurableOriginal({ workspaceId, assetId: durableAssetId, file });
        durableRef = stored.durableRef;
        durableUrl = stored.durableUrl;
      } catch (error) {
        console.error('Durable original store failed:', error);
        return NextResponse.json(
          { error: 'Unable to save the original to durable storage.' },
          { status: 502 }
        );
      }
    }

    const uploadForm = new FormData();
    uploadForm.append('file', file);

    let response: Response;
    try {
      response = await uploadWithRetry(apiKey, uploadForm);
    } catch (error) {
      return muAPIUnavailableResponse(error);
    }

    const parsed = await safeApiJson(response);

    if (response.ok) {
      const url = typeof parsed === 'object' && parsed !== null
        ? (parsed as any).url || (parsed as any).file_url || (parsed as any).data?.url
        : undefined;

      if (!url || typeof url !== 'string') {
        logUploadFailure('UPSTREAM_NO_URL', { upstreamStatus: response.status });
        return fail('UPSTREAM_NO_URL', 'No URL returned from file upload', 502);
      }

      return NextResponse.json({
        url,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: Date.now(),
        expiresAt: Date.now() + 60 * 60 * 1000,
        source: durableRef ? 'durable' : 'bytes',
        durableRef,
        durableUrl,
      });
    }

    return upstreamErrorResponse(response, parsed);
  } catch (error) {
    console.error('Upload file exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { createHmac } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import {
  isForwardableWebhook, isPrivateAddress, sanitizeData, savedWebhooks, leadConfigFor, MAX_DATA_BYTES,
  isValidEmail, savedNotifyEmail, savedNotifyEmails, uniqueEmails, buildLeadEmail,
  isRetryable, backoffMs, hostOf, deriveSigningSecret, signWebhook, MAX_ATTEMPTS,
  savedEsp, leadContact, keyResolver, espRequests, espCheckRequest, encryptSecret, decryptSecret,
  sanitizeSource, attributionOf, looksAutomated, MIN_FILL_MS, isDisposableEmail, emailProblem, chatPreset, chatBody, leadAlertText, autoReplySettings, buildAutoReply, AUTO_REPLY_DEFAULT_SUBJECT, declaredEmailKeys, autoReplyReplyTo,
} from '../../supabase/functions/lead-capture/logic.ts';

describe('lead-capture webhook safety', () => {
  it('accepts normal public https endpoints', () => {
    expect(isForwardableWebhook('https://hooks.zapier.com/hooks/catch/1/abc')).toBe(true);
    expect(isForwardableWebhook('https://example.com:443/x')).toBe(true);
  });
  it.each([
    'http://example.com/x', 'https://localhost/x', 'https://svc.internal/x', 'https://printer.local/x',
    'https://10.1.2.3/x', 'https://127.0.0.1/x', 'https://169.254.169.254/latest', 'https://192.168.1.1/x',
    'https://172.20.0.1/x', 'https://100.64.0.1/x', 'https://198.18.0.1/x', 'https://[::1]/x',
    'https://2130706433/x', 'https://0x7f.1/x', 'https://intranet/x', 'https://user:pw@example.com/x',
    'https://example.com:8443/x', 'ftp://example.com', 'not a url', 42,
  ])('rejects %s', (u) => { expect(isForwardableWebhook(u)).toBe(false); });

  it('classifies resolved addresses', () => {
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
    expect(isPrivateAddress('10.0.0.1')).toBe(true);
    expect(isPrivateAddress('100.100.1.1')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fd00::1')).toBe(true);
    expect(isPrivateAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });
});

describe('lead data limits', () => {
  it('caps fields and total bytes (fits the 32KB column constraint)', () => {
    const big = {};
    for (let i = 0; i < 40; i += 1) big[`f${i}`] = '€'.repeat(2000); // 3 bytes each in UTF-8
    const out = sanitizeData(big);
    const bytes = new TextEncoder().encode(JSON.stringify(out)).length;
    expect(Object.keys(out).length).toBeLessThanOrEqual(20);
    expect(bytes).toBeLessThan(32768);
    expect(Object.values(out).join('').length * 3).toBeLessThanOrEqual(MAX_DATA_BYTES + 1000);
  });
  it('drops empties, long keys and non-objects', () => {
    expect(sanitizeData({ a: ' x ', b: '', c: null, ['k'.repeat(65)]: 'v' })).toEqual({ a: 'x' });
    expect(sanitizeData([1, 2])).toEqual({});
    expect(sanitizeData('str')).toEqual({});
  });
});

describe('saved webhooks come only from the stored project', () => {
  const project = {
    tracks: [{ items: [{ id: 'lf', type: 'lead-form', webhookUrl: 'https://hook.example.com/a', webhookUrl2: 'http://insecure.example.com' }] }],
    listBuilder: { enabled: true, webhookEnabled: true, webhook: 'https://hook.example.com/b', webhook2: { value: 'https://hook.example.com/c' }, webhook3: 'https://10.0.0.1/x' },
  };
  it('finds clip and list-builder configs and filters unsafe URLs', () => {
    const clip = leadConfigFor(project, 'lead-form', 'lf');
    expect(savedWebhooks(clip.config, false)).toEqual(['https://hook.example.com/a']);
    const lb = leadConfigFor(project, 'list-builder', null);
    expect(savedWebhooks(lb.config, true)).toEqual(['https://hook.example.com/b', 'https://hook.example.com/c']);
    expect(leadConfigFor(project, 'lead-form', 'missing').config).toBeNull();
  });
});

describe('lead-capture notification email', () => {
  it('validates addresses', () => {
    expect(isValidEmail('me@example.com')).toBe(true);
    expect(['', 'a@b', 'a b@c.com', 'a@b.com, c@d.com', '<x@y.com>', 42, null].some((v) => isValidEmail(v))).toBe(false);
  });

  it('reads the recipient from the saved config only when notifications are on', () => {
    expect(savedNotifyEmail({ emailNotificationEnabled: true, notificationEmail: ' me@example.com ' })).toBe('me@example.com');
    expect(savedNotifyEmail({ emailNotificationEnabled: false, notificationEmail: 'me@example.com' })).toBe('');
    expect(savedNotifyEmail({ emailEnabled: true, emailAddress: 'lb@example.com' }, true)).toBe('lb@example.com');
    expect(savedNotifyEmail({ emailEnabled: true, emailAddress: 'bad' }, true)).toBe('');
    expect(savedNotifyEmail(null)).toBe('');
  });

  it('notifies up to 3 people, skipping invalid and repeated addresses', () => {
    const lg = { emailNotificationEnabled: true, notificationEmail: 'a@x.com', notificationEmail2: ' B@x.com ', notificationEmail3: 'c@x.com' };
    expect(savedNotifyEmails(lg)).toEqual(['a@x.com', 'B@x.com', 'c@x.com']);
    expect(savedNotifyEmails({ ...lg, notificationEmail2: 'A@X.com', notificationEmail3: 'nope' })).toEqual(['a@x.com']);
    expect(savedNotifyEmails({ ...lg, emailNotificationEnabled: false })).toEqual([]);
    const lb = { emailEnabled: true, emailAddress: 'one@x.com', emailAddress2: { value: 'two@x.com' }, emailAddress3: 'three@x.com' };
    expect(savedNotifyEmails(lb, true)).toEqual(['one@x.com', 'two@x.com', 'three@x.com']);
    expect(savedNotifyEmails({ ...lb, emailEnabled: false }, true)).toEqual([]);
    expect(savedNotifyEmails(null)).toEqual([]);
    // an older project that only saved the single address still works
    expect(savedNotifyEmails({ emailNotificationEnabled: true, notificationEmail: 'old@x.com' })).toEqual(['old@x.com']);
    expect(uniqueEmails(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com'])).toHaveLength(3);
  });

  it('escapes viewer-supplied values and keeps the subject on one line', () => {
    const { subject, html, text } = buildLeadEmail('lead-form', { EMAIL: 'x@y.com\nBcc: evil@z.com', NAME: '<script>alert(1)</script>' });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(text).toContain('NAME: <script>alert(1)</script>');
  });
});

describe('lead-capture webhook retries + signing', () => {
  it('retries only transient failures', () => {
    for (const st of [null, 408, 429, 500, 502, 503]) expect(isRetryable(st)).toBe(true);
    for (const st of [200, 301, 400, 401, 403, 404, 410, 422]) expect(isRetryable(st)).toBe(false);
    expect(MAX_ATTEMPTS).toBe(3);
    expect(backoffMs(1)).toBeLessThan(backoffMs(2));
  });

  it('logs the host only, never the path or query (they can hold secrets)', () => {
    expect(hostOf('https://hooks.zapier.com/hooks/catch/123/secret?token=abc')).toBe('hooks.zapier.com');
    expect(hostOf('nope')).toBe('invalid');
  });

  it('signs "<t>.<body>" with HMAC-SHA256 so a receiver can verify it', async () => {
    const body = JSON.stringify({ event: 'video_opted_in', data: { EMAIL: 'a@b.co' } });
    const header = await signWebhook('whsec_test', body, 1700000000);
    const expected = createHmac('sha256', 'whsec_test').update(`1700000000.${body}`).digest('hex');
    expect(header).toBe(`t=1700000000,v1=${expected}`);
    expect(await signWebhook('other', body, 1700000000)).not.toBe(header);
  });

  it('derives a stable, distinct secret per owner and none without a master secret', async () => {
    const a = await deriveSigningSecret('master', 'user_a');
    expect(a).toBe(await deriveSigningSecret('master', 'user_a'));
    expect(a).toBe(`whsec_${createHmac('sha256', 'master').update('webhook-signing:user_a').digest('hex')}`);
    expect(a).not.toBe(await deriveSigningSecret('master', 'user_b'));
    expect(await deriveSigningSecret('', 'user_a')).toBe('');
    expect(await deriveSigningSecret('master', '')).toBe('');
  });
});

describe('lead-capture email-list delivery', () => {
  it('reads the provider and tag/group id from saved config', () => {
    expect(savedEsp({ espProvider: 'kit', espListId: ' 123 ' })).toEqual({ provider: 'kit', listId: '123' });
    expect(savedEsp({ espProvider: 'mailerlite', espListId: '' })).toEqual({ provider: 'mailerlite', listId: '' });
    expect(savedEsp({ espProvider: 'kit', espListId: '12/../x' })).toEqual({ provider: 'kit', listId: '' });
    expect(savedEsp({ espProvider: 'mailchimp' })).toBeNull();
    expect(savedEsp({})).toBeNull();
    expect(savedEsp(null)).toBeNull();
  });

  it('picks the email (and name) out of a lead', () => {
    expect(leadContact({ NAME: 'Ada', EMAIL: 'ada@x.io' })).toEqual({ email: 'ada@x.io', name: 'Ada' });
    expect(leadContact({ 'EMAIL ADDRESS': 'a@b.co' })).toEqual({ email: 'a@b.co', name: '' });
    // the answer key is the editable field label, so a valid address under any label still counts
    expect(leadContact({ 'CONTACT ADDRESS': 'c@x.io', NAME: 'Cy' })).toEqual({ email: 'c@x.io', name: 'Cy' });
    // ...but a MAIL-labelled value wins when there are several
    expect(leadContact({ 'BACKUP': 'z@x.io', EMAIL: 'a@x.io' })).toEqual({ email: 'a@x.io', name: '' });
    expect(leadContact({ PHONE: '555', 'CONTACT ADDRESS': 'nope' })).toBeNull();
    expect(leadContact({ PHONE: '555', EMAIL: 'not-an-email' })).toBeNull();
    expect(leadContact({ PHONE: '555' })).toBeNull();
  });

  it('builds Kit calls: create the subscriber, then tag them', () => {
    const calls = espRequests('kit', 'k_123456789', '77', { email: 'a@b.co', name: 'Ada' });
    expect(calls.map((c) => c.url)).toEqual(['https://api.kit.com/v4/subscribers', 'https://api.kit.com/v4/tags/77/subscribers']);
    expect(calls[0].init.headers['X-Kit-Api-Key']).toBe('k_123456789');
    expect(JSON.parse(calls[0].init.body)).toEqual({ email_address: 'a@b.co', first_name: 'Ada' });
    expect(JSON.parse(calls[1].init.body)).toEqual({ email_address: 'a@b.co' });
    expect(espRequests('kit', 'k_123456789', '', { email: 'a@b.co', name: '' })).toHaveLength(1);
  });

  it('builds one MailerLite call with the group', () => {
    const [call, ...rest] = espRequests('mailerlite', 'ml_123456789', '9', { email: 'a@b.co', name: 'Ada' });
    expect(rest).toHaveLength(0);
    expect(call.url).toBe('https://connect.mailerlite.com/api/subscribers');
    expect(call.init.headers.Authorization).toBe('Bearer ml_123456789');
    expect(JSON.parse(call.init.body)).toEqual({ email: 'a@b.co', fields: { name: 'Ada' }, groups: ['9'] });
  });

  it('only ever calls the fixed provider hosts', () => {
    for (const p of ['kit', 'mailerlite']) {
      const urls = [...espRequests(p, 'key_123456', '1', { email: 'a@b.co', name: '' }), espCheckRequest(p, 'key_123456')].map((c) => new URL(c.url).hostname);
      expect(urls.every((h) => ['api.kit.com', 'connect.mailerlite.com'].includes(h))).toBe(true);
    }
  });

  it('encrypts API keys at rest and decrypts only with the right master key', async () => {
    const token = await encryptSecret('master-key', 'sk_live_abc123');
    expect(token).toMatch(/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
    expect(token).not.toContain('sk_live_abc123');
    expect(token).not.toBe(await encryptSecret('master-key', 'sk_live_abc123')); // fresh IV each time
    expect(await decryptSecret('master-key', token)).toBe('sk_live_abc123');
    expect(await decryptSecret('wrong-key', token)).toBe('');
    expect(await decryptSecret('master-key', 'garbage')).toBe('');
  });
});

describe('lead-capture source / UTM', () => {
  it('keeps the page and browser, plus only known utm keys and an http(s) referrer', () => {
    const out = sanitizeSource({
      page: 'https://x.test/watch/abc?utm_source=g', userAgent: 'UA',
      utm: { source: ' google ', campaign: 'spring\nsale', medium: '', evil: 'x', term: 42 },
      referrer: 'https://news.example.com/post',
      admin: true,
    });
    expect(out).toEqual({ page: 'https://x.test/watch/abc?utm_source=g', userAgent: 'UA', utm: { source: 'google', campaign: 'springsale' }, referrer: 'https://news.example.com/post' });
  });

  it('drops bad values and caps lengths', () => {
    expect(sanitizeSource(null)).toEqual({ page: null, userAgent: null });
    expect(sanitizeSource({ referrer: 'javascript:alert(1)', utm: 'nope' })).toEqual({ page: null, userAgent: null });
    expect(sanitizeSource({ utm: { source: 'a'.repeat(500) } }).utm.source).toHaveLength(100);
    expect(sanitizeSource({ referrer: 'https://x.test/' + 'a'.repeat(900) }).referrer).toHaveLength(300);
    expect(sanitizeSource({ page: 'p'.repeat(900) }).page).toHaveLength(512);
  });

  it('exposes only the marketing attribution for webhooks and emails', () => {
    const src = sanitizeSource({ page: 'p', userAgent: 'UA', utm: { source: 'g' }, referrer: 'https://r.test/x' });
    expect(attributionOf(src)).toEqual({ utm: { source: 'g' }, referrer: 'https://r.test/x' });
    expect(attributionOf(sanitizeSource({ page: 'p' }))).toEqual({});
  });

  it('adds an escaped Source block to the lead email only when there is one', () => {
    const plain = buildLeadEmail('lead-form', { EMAIL: 'a@b.co' });
    expect(plain.html).not.toContain('Source');
    expect(plain.text).not.toContain('Source');
    const withSrc = buildLeadEmail('lead-form', { EMAIL: 'a@b.co' }, { utm: { source: 'google', campaign: '<b>x</b>' }, referrer: 'https://r.test/p' });
    expect(withSrc.html).toContain('Source');
    expect(withSrc.html).toContain('utm_source');
    expect(withSrc.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(withSrc.html).not.toContain('<b>x</b>');
    expect(withSrc.text).toContain('utm_campaign: <b>x</b>');
    expect(withSrc.text).toContain('Referrer: https://r.test/p');
  });
});

describe('lead-capture spam signals', () => {
  it('flags a filled honeypot or a form finished faster than a person can', () => {
    expect(looksAutomated({ hp: 'http://spam' })).toBe(true);
    expect(looksAutomated({ ms: 300 })).toBe(true);
    expect(looksAutomated({ ms: MIN_FILL_MS })).toBe(false);
    expect(looksAutomated({ ms: 8000, hp: '' })).toBe(false);
  });
  it('lets old clients and prefilled forms through (no signals, or no timing)', () => {
    expect(looksAutomated(undefined)).toBe(false);
    expect(looksAutomated(null)).toBe(false);
    expect(looksAutomated([])).toBe(false);
    expect(looksAutomated({ hp: '' })).toBe(false); // prefilled form: honeypot only, no timing
  });
  it('recognises throwaway inboxes, including subdomains', () => {
    expect(isDisposableEmail('x@mailinator.com')).toBe(true);
    expect(isDisposableEmail('X@Mailinator.COM')).toBe(true);
    expect(isDisposableEmail('x@mail.mailinator.com')).toBe(true);
    expect(isDisposableEmail('x@gmail.com')).toBe(false);
    expect(isDisposableEmail('nope')).toBe(false);
  });
  it('emailProblem: bad format always; throwaway only when the owner turned it on', () => {
    expect(emailProblem({ EMAIL: 'not-an-email' })).toMatch(/valid email/i);
    expect(emailProblem({ EMAIL: 'x@mailinator.com' })).toBe('');
    expect(emailProblem({ EMAIL: 'x@mailinator.com' }, { blockDisposable: true })).toMatch(/permanent/i);
    expect(emailProblem({ 'FIRST NAME': 'Ann', EMAIL: 'ann@gmail.com' }, { blockDisposable: true })).toBe('');
    expect(emailProblem({ PHONE: '555' })).toBe('');
  });
});

describe('lead-capture A/B version', () => {
  it('keeps A or B in the stored source and nothing else', () => {
    expect(sanitizeSource({ page: 'https://x/watch/Abc', variant: 'B' }).variant).toBe('B');
    expect(sanitizeSource({ variant: 'A' }).variant).toBe('A');
    for (const bad of ['C', 'b', 1, null, { x: 1 }]) expect(sanitizeSource({ variant: bad })).not.toHaveProperty('variant');
  });
});

describe('lead-capture chat alert presets', () => {
  const slack = 'https://hooks.slack.com/services/T000/B000/XXXX';
  const discord = 'https://discord.com/api/webhooks/123456/abcdef';
  const teams = 'https://contoso.webhook.office.com/webhookb2/abc/IncomingWebhook/def/ghi';
  it('recognises Slack, Discord and Teams webhook URLs and nothing else', () => {
    expect(chatPreset(slack)).toBe('slack');
    expect(chatPreset(discord)).toBe('discord');
    expect(chatPreset('https://canary.discord.com/api/webhooks/1/x')).toBe('discord');
    expect(chatPreset(teams)).toBe('teams');
    expect(chatPreset('https://outlook.office.com/webhook/abc')).toBe('teams');
    for (const other of ['https://example.com/hook', 'https://hooks.slack.com/other/path', 'https://evil.com/api/webhooks/1/x', 'https://discord.com/channels/1', 'http://hooks.slack.com/services/a/b/c', 'https://hooks.slack.com.evil.com/services/a', 'not a url', '']) {
      expect(chatPreset(other)).toBeNull();
    }
  });
  const alert = leadAlertText('lead-form', { EMAIL: 'ann@x.co', 'FIRST NAME': 'Ann' }, { utm: { source: 'newsletter', campaign: 'spring' } });
  it('words the alert: a title, the answers and where it came from', () => {
    expect(alert.title).toBe('New lead');
    expect(alert.lines).toEqual(['EMAIL: ann@x.co', 'FIRST NAME: Ann', 'Came from: newsletter / spring']);
    expect(leadAlertText('list-builder', {}).title).toBe('New List Builder sign-up');
    expect(leadAlertText('call-attempt', {}).title).toBe('Someone tried to call you');
    expect(leadAlertText('lead-form', { A: 'x' }, { referrer: 'https://news.example.org/post' }).lines.at(-1)).toBe('Came from: news.example.org');
  });
  it('limits what an alert carries', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`K${i}`, 'v'.repeat(500)]));
    const { lines } = leadAlertText('lead-form', many);
    expect(lines).toHaveLength(10);
    expect(lines[0].length).toBeLessThanOrEqual(250);
  });
  it('shapes each app\'s body', () => {
    expect(chatBody('slack', alert)).toEqual({ text: '*New lead*\nEMAIL: ann@x.co\nFIRST NAME: Ann\nCame from: newsletter / spring' });
    const d = chatBody('discord', alert);
    expect(d.content).toContain('**New lead**'); expect(d.allowed_mentions).toEqual({ parse: [] });
    const t = chatBody('teams', alert);
    expect(t['@type']).toBe('MessageCard'); expect(t.title).toBe('New lead'); expect(String(t.text)).toContain('EMAIL: ann@x.co');
  });
  it('treats viewer-supplied text as data: escapes Slack markup and defuses mentions', () => {
    const evil = leadAlertText('lead-form', { NAME: '<!channel> & <https://evil.test|click> @everyone' });
    const s = String(chatBody('slack', evil).text);
    expect(s).not.toContain('<!channel>'); expect(s).toContain('&lt;!channel&gt;'); expect(s).toContain('&amp;'); expect(s).not.toContain('@everyone'); expect(s).toContain('@\u200beveryone');
    expect(String(chatBody('slack', leadAlertText('lead-form', { EMAIL: 'ann@x.co' })).text)).toContain('ann@x.co'); // emails are left alone
    const d = String(chatBody('discord', evil).content);
    expect(d).not.toContain('@everyone');
    expect(String(chatBody('teams', evil).text)).not.toContain('@everyone');
  });
  it('keeps a Discord message under its 2,000 character limit', () => {
    const big = { title: 'x'.repeat(1500), lines: ['y'.repeat(1500)] };
    expect(String(chatBody('discord', big).content).length).toBeLessThanOrEqual(2000);
  });
});

describe('lead-capture auto-reply', () => {
  it('is off unless the owner switched it on, and defaults the wording', () => {
    expect(autoReplySettings(null)).toBeNull();
    expect(autoReplySettings({})).toBeNull();
    expect(autoReplySettings({ autoReplyEnabled: 'yes' })).toBeNull(); // only a real true
    const on = autoReplySettings({ autoReplyEnabled: true });
    expect(on.subject).toBe(AUTO_REPLY_DEFAULT_SUBJECT); expect(on.body).toContain('{{video_link}}');
  });
  it('caps and cleans the owner text', () => {
    const s = autoReplySettings({ autoReplyEnabled: true, autoReplySubject: 'Hello\r\nBcc: spam@x.co', autoReplyBody: 'b'.repeat(5000) });
    expect(s.subject).not.toMatch(/[\r\n]/); expect(s.body).toHaveLength(1000);
  });
  const s = { subject: 'Hi {{first_name}}', body: 'Hi {{first_name}}, watch: {{video_link}}' };
  it('fills only the first name and the video link', () => {
    const m = buildAutoReply(s, { firstName: 'Ann Lee', videoUrl: 'https://app.test/watch/Abc123XyZ9' });
    expect(m.text).toBe('Hi Ann, watch: https://app.test/watch/Abc123XyZ9');
    expect(m.subject).toBe('Hi Ann');
    expect(m.html).toContain('https://app.test/watch/Abc123XyZ9');
    expect(buildAutoReply(s, { videoUrl: 'https://app.test/watch/x' }).text).toBe('Hi there, watch: https://app.test/watch/x');
  });
  it('a name a viewer typed cannot add markup, links or extra headers', () => {
    const m = buildAutoReply({ subject: 'Hi {{first_name}}', body: 'Hi {{first_name}}' }, { firstName: '<img src=x onerror=alert(1)>\r\nBcc: a@b.co http://evil.test', videoUrl: 'https://app.test/watch/x' });
    expect(m.html).not.toContain('<img'); expect(m.html).toContain('&lt;img');
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.text).not.toContain('http://evil.test'); // only the first word of the name is used
  });
  it('escapes the owner body in HTML too, and drops unknown tokens from the subject', () => {
    const m = buildAutoReply({ subject: 'Hi {{unknown}} there', body: '<b>Hi</b> & {{video_link}}' }, { videoUrl: 'https://app.test/watch/x' });
    expect(m.html).toContain('&lt;b&gt;Hi&lt;/b&gt; &amp; https://app.test/watch/x');
    expect(m.subject).toBe('Hi  there');
  });
});

describe('lead-capture viewing session', () => {
  it('keeps only a well-formed session id', () => {
    expect(sanitizeSource({ session: 'abcDEF1234567890abcd' }).session).toBe('abcDEF1234567890abcd');
    for (const bad of ['short', 'has spaces in it 1234567890', 'x'.repeat(65), 12345, null, { a: 1 }]) expect(sanitizeSource({ session: bad })).not.toHaveProperty('session');
  });
});

describe('lead-capture email checks follow the declared field types', () => {
  const lb = { elements: [{ label: 'Email', token: 'EMAIL', type: 'email' }, { label: 'Email me updates', token: 'EMAIL ME UPDATES', type: 'checkbox' }, { label: 'Preferred email frequency', token: 'PREFERRED EMAIL FREQUENCY', type: 'select' }, { label: 'Work contact', token: 'WORK CONTACT', type: 'email' }] };
  it('finds the email fields of a List Builder', () => {
    expect([...declaredEmailKeys(lb)].sort()).toEqual(['EMAIL', 'WORK CONTACT']);
  });
  it('finds the email fields of a Lead Generator clip (label keys, duplicates numbered)', () => {
    const lg = { fields: [{ id: 'a', type: 'email', label: 'Email' }, { id: 'b', type: 'email', label: 'Email' }, { id: 'c', type: 'checkbox', label: 'Email me updates' }] };
    expect([...declaredEmailKeys(lg)].sort()).toEqual(['EMAIL', 'EMAIL_2']);
  });
  it('is null when the field types are not known, so the name check still applies', () => {
    expect(declaredEmailKeys(null)).toBeNull(); expect(declaredEmailKeys({})).toBeNull();
  });
  it('a checkbox or dropdown whose label mentions email is not rejected', () => {
    const emailKeys = declaredEmailKeys(lb);
    const data = { EMAIL: 'ann@x.co', 'EMAIL ME UPDATES': 'Yes', 'PREFERRED EMAIL FREQUENCY': 'Weekly' };
    expect(emailProblem(data, { emailKeys })).toBe('');
    expect(emailProblem(data)).toMatch(/valid email/i); // the old name check would have rejected it
  });
  it('still rejects a bad real email, and throwaway ones when switched on', () => {
    const emailKeys = declaredEmailKeys(lb);
    expect(emailProblem({ EMAIL: 'nope', 'EMAIL ME UPDATES': 'Yes' }, { emailKeys })).toMatch(/valid email/i);
    expect(emailProblem({ 'WORK CONTACT': 'x@mailinator.com' }, { emailKeys, blockDisposable: true })).toMatch(/permanent/i);
    expect(emailProblem({ EMAIL: 'x@mailinator.com' }, { emailKeys })).toBe('');
  });
  it('a form with no email field accepts whatever the other fields say', () => {
    expect(emailProblem({ NAME: 'Ann', 'EMAIL ME': 'Yes' }, { emailKeys: new Set() })).toBe('');
  });
});

describe('lead-capture auto-reply reply-to', () => {
  it('uses the owner\'s address, then the first notification address, then none', () => {
    expect(autoReplyReplyTo({ autoReplyReplyTo: ' me@x.co ' }, ['n@x.co'])).toBe('me@x.co');
    expect(autoReplyReplyTo({ autoReplyReplyTo: 'not an email' }, ['n@x.co'])).toBe('n@x.co');
    expect(autoReplyReplyTo({}, ['n@x.co', 'm@x.co'])).toBe('n@x.co');
    expect(autoReplyReplyTo({}, [])).toBe('');
    expect(autoReplyReplyTo(null)).toBe('');
    expect(autoReplyReplyTo({ autoReplyReplyTo: 'a@b.co\r\nBcc: x@y.co' }, [])).toBe(''); // no header injection
  });
});

describe('lead-capture Teams Workflows alerts', () => {
  const wf = 'https://prod-12.westus.logic.azure.com:443/workflows/abc123/triggers/manual/paths/invoke?api-version=2016-06-01&sig=x';
  it('recognises Workflows URLs (and keeps the legacy connector)', () => {
    expect(chatPreset(wf)).toBe('teams-workflow');
    expect(chatPreset('https://default1234.12.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/abc/triggers/manual/paths/invoke')).toBe('teams-workflow');
    expect(chatPreset('https://contoso.webhook.office.com/webhookb2/abc/IncomingWebhook/d/e')).toBe('teams');
    for (const other of ['https://logic.azure.com.evil.com/workflows/abc', 'https://prod-1.logic.azure.com/other/path', 'http://prod-1.logic.azure.com/workflows/a']) expect(chatPreset(other)).toBeNull();
  });
  it('sends a message with an Adaptive Card, title first, one block per line, pings defused', () => {
    const body = chatBody('teams-workflow', { title: 'New lead', lines: ['EMAIL: ann@x.co', 'NOTE: hi @everyone'] });
    expect(body.type).toBe('message');
    const card = body.attachments[0];
    expect(card.contentType).toBe('application/vnd.microsoft.card.adaptive');
    expect(card.content.type).toBe('AdaptiveCard');
    expect(card.content.body.map((b) => b.text)).toEqual(['New lead', 'EMAIL: ann@x.co', 'NOTE: hi @\u200beveryone']);
    expect(card.content.body[0].weight).toBe('Bolder');
  });
});

describe('keyResolver', () => {
  it('uses the environment value without asking the database', async () => {
    const fetchStored = vi.fn(async () => 'stored');
    expect(await keyResolver('from-env', fetchStored)()).toBe('from-env');
    expect(fetchStored).not.toHaveBeenCalled();
  });
  it('falls back to the stored key and remembers it', async () => {
    const fetchStored = vi.fn(async () => 'stored');
    const get = keyResolver('', fetchStored);
    expect(await get()).toBe('stored');
    expect(await get()).toBe('stored');
    expect(fetchStored).toHaveBeenCalledTimes(1);
  });
  it('gives "" when nothing is configured, and asks again next time', async () => {
    const fetchStored = vi.fn(async () => '');
    const get = keyResolver('', fetchStored);
    expect(await get()).toBe('');
    expect(await get()).toBe('');
    expect(fetchStored).toHaveBeenCalledTimes(2);
  });
  it('treats a failed lookup as not configured (no throw) and recovers later', async () => {
    const fetchStored = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue('stored');
    const get = keyResolver('', fetchStored);
    expect(await get()).toBe('');
    expect(await get()).toBe('stored');
  });
});

import { describe, it, expect, vi } from 'vitest';
import {
  submitLead, fetchLeads, postWebhooksDirect, leadsToCsv, mergeLeads, webhookUrlsFor, sanitizeLeadData,
  defaultListBuilder, listBuilderFields, listBuilderWebhookConfig, switchListBuilderKind, savePersonalizerProfile,
  buildOptinForm, showListBuilderOverlay, showPauseOverlay, ensureOverlayLayer, formBackground,
  renderAddonEditor, getAddon,
} from '../index.js';

describe('lead client', () => {
  it('only forwards enabled, https webhooks', () => {
    expect(webhookUrlsFor({ webhookEnabled: false, webhookUrl: 'https://a.test/h' })).toEqual([]);
    expect(webhookUrlsFor({
      webhookEnabled: true, webhookUrl: 'https://a.test/h', webhookUrl2: 'http://insecure.test', webhookUrl3: 'javascript:alert(1)',
    })).toEqual(['https://a.test/h']);
  });

  it('sanitizes lead data', () => {
    expect(sanitizeLeadData({ EMAIL: ' a@b.c ', empty: '', n: null })).toEqual({ EMAIL: 'a@b.c' });
  });

  it('writes RFC 4180 CSV (quotes, commas and newlines are escaped)', () => {
    const csv = leadsToCsv([{ name: 'Ann, "A"', note: 'line1\nline2' }]);
    expect(csv).toBe('"name","note"\r\n"Ann, ""A""","line1\nline2"');
  });

  it('merges stored and session leads without double counting', () => {
    const merged = mergeLeads([{ e: 'x', _stored: true }, { e: 'y', _stored: false }], [{ e: 'x' }]);
    expect(merged).toEqual([{ e: 'x' }, { e: 'y' }]);
  });

  it('submits through the lead-capture edge function', async () => {
    const supabase = { functions: { invoke: vi.fn().mockResolvedValue({ data: { ok: true, stored: true, forwarded: 1, failed: 0 }, error: null }) } };
    const res = await submitLead(supabase, { projectId: 'p', clipId: 7, data: { EMAIL: 'a@b.c' }, webhooks: ['https://h.test'] });
    expect(res).toEqual({ stored: true, forwarded: 1, failed: 0, error: null });
    const [name, { body }] = supabase.functions.invoke.mock.calls[0];
    expect(name).toBe('lead-capture');
    expect(body).toMatchObject({ projectId: 'p', clipId: '7', kind: 'lead-form', data: { EMAIL: 'a@b.c' }, webhooks: ['https://h.test'] });
  });

  it('reports backend failure (thrown or error) so the caller can fall back', async () => {
    const thrown = { functions: { invoke: vi.fn().mockRejectedValue(new Error('offline')) } };
    expect((await submitLead(thrown, { data: { a: '1' } })).error).toBe('offline');
    const errored = { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { message: 'nope' } }) } };
    expect((await submitLead(errored, { data: { a: '1' } })).error).toBe('nope');
    expect(await fetchLeads(thrown, { clipId: 1 })).toEqual([]);
  });

  it('falls back to direct webhook posts', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });
    expect(await postWebhooksDirect(['https://a', 'https://b'], { x: 1 }, fetchImpl)).toEqual({ forwarded: 1, failed: 1 });
  });
});

describe('List Builder / Personalizer (upstream retarget form)', () => {
  it('uses upstream manifest defaults', () => {
    const lb = defaultListBuilder();
    expect(lb).toMatchObject({
      fontFamily: 'Raleway', btnText: 'Play', buttonBackground: '#eb5054', buttonBorderRadius: 5,
      btnBottomBorder: '#eb5054', innerWidth: 65, captionFontSize: 76, fontSize: 60,
      popupHeaderText: 'Create your very own personalized video', popupFillOutText: 'Fill out your',
    });
    expect(lb.elements).toEqual([{ id: 0, label: 'Email', token: 'EMAIL', type: 'email' }]);
  });

  it('Personalizer uses DEFAULT_OPTIONS_OPTIN and hides integrations / disclaimer', () => {
    const p = defaultListBuilder('personalizer');
    expect(p).toMatchObject({ isPersonalizer: true, backgroundColor: '#272735', innerWidth: 90, captionFontSize: 75, fontSize: 68 });
    expect(p.elements.map((e) => e.token)).toEqual(['EMAIL', 'FIRST NAME', 'LAST NAME']);
    const tabs = new Set(listBuilderFields(p).map((f) => f.tab));
    expect(tabs.has('Integrations')).toBe(false);
    expect(new Set(listBuilderFields(defaultListBuilder()).map((f) => f.tab))).toEqual(new Set(['Styles', 'Fields', 'Integrations']));
  });

  it('switching kind keeps enabled and swaps defaults', () => {
    const next = switchListBuilderKind({ ...defaultListBuilder(), enabled: true }, 'personalizer');
    expect(next.enabled).toBe(true);
    expect(next.kind).toBe('personalizer');
    expect(next.elements).toHaveLength(3);
  });

  it('maps upstream webhook / webhook2 / webhook3 to lead-client config', () => {
    expect(listBuilderWebhookConfig({ webhookEnabled: true, webhook: 'https://a', webhook2: { value: 'https://b' }, webhook3: '' }))
      .toEqual({ webhookEnabled: true, webhookUrl: 'https://a', webhookUrl2: 'https://b', webhookUrl3: '' });
  });

  it('Personalizer answers become the active personalization profile', () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    const profile = savePersonalizerProfile({ EMAIL: 'a@b.c', 'FIRST NAME': 'Ann', 'LAST NAME': 'Lee' }, storage);
    expect(profile.variables).toEqual({ email: 'a@b.c', firstName: 'Ann', lastName: 'Lee', fullName: 'Ann Lee' });
    expect(store.get('remix_selected_contact_id')).toBe(profile.id);
  });

  it('builds the upstream form DOM: classes, token-named inputs, Play button, radial background', () => {
    const lb = { ...defaultListBuilder(), enableSkipButton: true, brandLogoSrc: 'https://x/logo.png' };
    const form = buildOptinForm(lb, { prefill: { EMAIL: 'pre@fill.ed' } });
    expect(form.classList.contains('retarget-form')).toBe(true);
    for (const sel of ['.form-inner', '.form-scrollable', '.form-scrollable-inner', '.brand-logo', '.retarget-caption', '.input-wrapper-container', '.buttons-inner', '.privacy-disclaimer', '.skip-button']) {
      expect(form.querySelector(sel), sel).not.toBeNull();
    }
    const email = form.querySelector('input[name="EMAIL"]');
    expect(email.type).toBe('email');
    expect(email.value).toBe('pre@fill.ed');
    expect(form.querySelector('button[type="submit"]').textContent).toBe('Play');
    expect(formBackground({ backgroundColor: '#000000' })).toMatch(/^radial-gradient\(circle, rgba\(0, 0, 0, 0.07\) 10%/);
  });

  it('applies the per-field-count layout (3 fields → 49% / 49% / grow)', () => {
    const lb = defaultListBuilder('personalizer');
    const form = buildOptinForm(lb);
    const inputs = form.querySelectorAll('.input-wrapper input');
    expect(inputs[0].style.width).toBe('49%');
    expect(inputs[2].style.flexGrow).toBe('5');
    expect(form.querySelector('.input-wrapper .buttons-inner')).not.toBeNull();
  });

  it('personalizer omits the privacy disclaimer; number fields strip non-digits', () => {
    const form = buildOptinForm({ ...defaultListBuilder('personalizer'), privacyDisclaimer: 'x', isPersonalizer: true, elements: [{ label: 'Age', token: 'AGE', type: 'number' }] });
    expect(form.querySelector('.privacy-disclaimer')).toBeNull();
    const age = form.querySelector('input[name="AGE"]');
    age.value = '4a2';
    age.dispatchEvent(new Event('input'));
    expect(age.value).toBe('42');
  });

  it('overlay shows the arrow hint, submits form data, and removes itself', async () => {
    const frame = document.createElement('div');
    const layer = ensureOverlayLayer(frame);
    expect(ensureOverlayLayer(frame)).toBe(layer);
    const onSubmit = vi.fn().mockResolvedValue('');
    const el = showListBuilderOverlay(layer, defaultListBuilder(), { onSubmit });
    expect(el.querySelector('.overlay-arrow.on .container-hint .title-hint').textContent).toBe('Create your very own personalized video');
    el.querySelector('input[name="EMAIL"]').value = 'v@x.io';
    el.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ EMAIL: 'v@x.io' }));
    await vi.waitFor(() => expect(layer.querySelector('[data-overlay="list-builder"]')).toBeNull());
  });

  it('pause overlay calls onContinue and removes itself', () => {
    const layer = ensureOverlayLayer(document.createElement('div'));
    const onContinue = vi.fn();
    showPauseOverlay(layer, { text: 'Go on', onContinue }).click();
    expect(onContinue).toHaveBeenCalled();
    expect(layer.children).toHaveLength(0);
  });
});

describe('schema settings editor', () => {
  it('renders upstream Loop settings and emits changes', () => {
    const box = document.createElement('div');
    const onChange = vi.fn();
    renderAddonEditor(box, { fields: getAddon('addon-loop').fields, options: { loop: 0 }, onChange });
    const select = box.querySelector('select[data-key="loop"]');
    expect(box.textContent).toContain('Number of loops (0 = forever)');
    expect(select.options).toHaveLength(11);
    select.value = '3';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange.mock.calls.at(-1)[0]).toEqual({ loop: '3' });
  });

  it('draws upstream tabs and edits the field list (token follows label)', () => {
    const box = document.createElement('div');
    const onChange = vi.fn();
    const lb = defaultListBuilder();
    renderAddonEditor(box, { options: lb, fieldsFor: listBuilderFields, onChange });
    expect([...box.querySelectorAll('[data-addon-tab]')].map((b) => b.textContent)).toEqual(['Styles', 'Fields', 'Integrations']);
    box.querySelector('[data-addon-tab="Fields"]').click();
    box.querySelector('.addon-fieldlist__add').click();
    let next = onChange.mock.calls.at(-1)[0];
    expect(next.elements).toHaveLength(2);
    const label = box.querySelectorAll('.addon-fieldlist__label')[1];
    label.value = 'Phone number';
    label.dispatchEvent(new Event('input', { bubbles: true }));
    next = onChange.mock.calls.at(-1)[0];
    expect(next.elements[1]).toMatchObject({ label: 'Phone number', token: 'PHONE NUMBER', type: 'singleline' });
  });
});

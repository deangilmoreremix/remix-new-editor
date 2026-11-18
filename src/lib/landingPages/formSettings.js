/**
 * Where a landing page's form answers go, in the List Builder's shape so the lead-capture function can use the
 * same helpers it uses for published videos. These settings are OWNER-ONLY (table landing_page_form_settings):
 * the page config is public, so webhook URLs and e-mail addresses never go in it.
 */
import { isValidWebhookUrl } from '../editor/addons/leadClient.js';

export const ESP_IDS = Object.freeze(['kit', 'mailerlite']);
const LIST_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export const defaultFormSettings = () => ({
  webhookEnabled: false, webhook: '', webhook2: '', webhook3: '',
  emailEnabled: false, emailAddress: '', emailAddress2: '', emailAddress3: '',
  espProvider: '', espListId: '',
});

const url = (v) => { const s = String(v || '').trim().slice(0, 500); return isValidWebhookUrl(s) ? s : ''; };
const email = (v) => { const s = String(v || '').trim().slice(0, 254); return EMAIL_RE.test(s) ? s : ''; };

/** Keep only known keys with valid values (https webhooks, real e-mail addresses, a known list provider). */
export function sanitizeFormSettings(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const provider = ESP_IDS.includes(r.espProvider) ? r.espProvider : '';
  const listId = String(r.espListId || '').trim();
  return {
    webhookEnabled: r.webhookEnabled === true,
    webhook: url(r.webhook), webhook2: url(r.webhook2), webhook3: url(r.webhook3),
    emailEnabled: r.emailEnabled === true,
    emailAddress: email(r.emailAddress), emailAddress2: email(r.emailAddress2), emailAddress3: email(r.emailAddress3),
    espProvider: provider,
    espListId: provider && LIST_ID_RE.test(listId) ? listId : '',
  };
}

/** The webhook addresses that are switched on and valid, as the Test button needs them. */
export const activeWebhooks = (s) => (s?.webhookEnabled ? [s.webhook, s.webhook2, s.webhook3].filter(Boolean) : []);

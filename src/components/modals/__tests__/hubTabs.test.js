import { describe, it, expect, vi } from 'vitest';
import { VideoPersonalizationHub } from '../VideoPersonalizationHub.jsx';

describe('Personalization Suite tabs', () => {
  it('keeps the popup visible when switching to analytics and shows real data', async () => {
    const getClient = vi.fn(async () => ({
      rpc: async (name) => (name === 'owner_portfolio_summary'
        ? { data: { plays: 7, unique_viewers: 3, cta_clicks: 1, call_clicks: 0, leads: 0 }, error: null }
        : { data: [], error: null }),
    }));
    const hub = new VideoPersonalizationHub({ getClient });
    hub.open();
    await new Promise((r) => setTimeout(r, 50));
    document.querySelector('.hub-tab[data-tab="analytics"]').click();
    await new Promise((r) => setTimeout(r, 80));
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay.classList.contains('active')).toBe(true);
    expect(document.body.textContent).toContain('Unique viewers');
    expect(document.body.textContent).not.toContain('+12.5%');
    hub.destroy();
  });
});

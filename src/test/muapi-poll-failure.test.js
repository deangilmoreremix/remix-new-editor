import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MuapiClient } from '../lib/muapi.js';

const pollResponse = (body) => vi.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: () => Promise.resolve(body),
}));

describe('pollForResult failure handling', () => {
  let client;

  beforeEach(async () => {
    client = new MuapiClient();
    await client.apiKeyManager.setMuapiKey('test-muapi-key');
  });

  test('stops on the first failed status instead of polling until timeout', async () => {
    global.fetch = pollResponse({ status: 'failed', error: 'content policy' });
    await expect(client.pollForResult('req-fail', 5, 10)).rejects.toThrow('Generation failed: content policy');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('mentions the refund when MuAPI refunded the job', async () => {
    global.fetch = pollResponse({ status: 'failed', error: 'timeout', cost: { refunded: true, amount_credits: 3 } });
    await expect(client.pollForResult('req-refund', 5, 10)).rejects.toThrow('Generation failed: timeout Refunded 3 credits.');
  });

  test('reports the balance from the proxy', async () => {
    global.fetch = pollResponse({ balance: 12.5 });
    await expect(client.getBalance()).resolves.toBe(12.5);
  });
});

// @vitest-environment jsdom
// Every muapi app in the Edit Studio, run through the REAL muapi client with only fetch faked.
// Asserts the uploaded image/video URLs land in the field each app's endpoint expects, so an app
// whose photo or video never reaches the model fails here and not in front of a paying user.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import appsMap from '../data/muapiStudioAppsMap.json';
import { EDIT_APPS, buildAppPrompt, splitAppControlValues } from '../lib/muapiEditApps.js';
import { muapi } from '../lib/muapi.js';

const IMG = 'https://cdn.muapi.ai/uploads/photo.png';
const END = 'https://cdn.muapi.ai/uploads/end-frame.png';
const VID = 'https://cdn.muapi.ai/uploads/clip.mp4';
const raw = Object.fromEntries(appsMap.apps.map((a) => [a.id, a]));

let sent;
beforeEach(() => {
  vi.spyOn(muapi.apiKeyManager, 'hasMuapiKey').mockReturnValue(true);
  vi.spyOn(muapi.apiKeyManager, 'getMuapiKey').mockReturnValue('test-key');
  sent = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    if (body) sent.push(body);
    // Like MuAPI: a submit answers with a request id; the result is fetched by polling (stubbed below).
    return new Response(JSON.stringify({ request_id: 'req-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  vi.spyOn(muapi, 'pollForResult').mockResolvedValue({ status: 'completed', outputs: ['https://cdn.muapi.ai/out/result'] });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// What the Edit Studio sends for an app: its model, the default control values and the uploaded files.
function paramsFor(tool, { withEnd = false } = {}) {
  const values = {};
  for (const c of tool.controls) {
    if (c.type === 'camera3d' || c.default === undefined || c.default === '') continue;
    values[c.key] = c.default;
  }
  const { style_preset, adjustments, params: controls } = splitAppControlValues(values);
  const params = { model: tool.model, ...controls, extraParams: { ...controls } };
  params[tool.primary.param] = tool.primary.type === 'video' ? VID : IMG;
  if (tool.secondary) {
    if (tool.secondary.type === 'video') params[tool.secondary.param] = VID;
    else if (!tool.secondary.optional || withEnd) params[tool.secondary.param] = tool.secondary.type === 'frame' ? END : IMG;
  }
  if (tool.hasPrompt) params.prompt = buildAppPrompt(tool, { style_preset, adjustments, extra: '' });
  return params;
}
const call = (tool, params) => (tool.route === 'i2i' ? muapi.generateI2I(params) : tool.route === 'i2v' ? muapi.generateI2V(params) : muapi.processV2V(params));

describe('all muapi Edit Studio apps send their uploads to the model', () => {
  test('there are 72 apps to cover', () => expect(EDIT_APPS.length).toBe(72));

  for (const tool of EDIT_APPS) {
    const app = raw[tool.appId];
    test(`${tool.name} (${tool.route}): image/video reach ${app.endpoint.path}`, async () => {
      const result = await call(tool, paramsFor(tool, { withEnd: true }));
      expect(result.url, 'a result URL comes back').toBeTruthy();
      expect(sent.length).toBe(1);
      const { endpoint, params } = sent[0];
      expect(`/api/v1/${endpoint}`).toBe(app.endpoint.path);

      // The primary file, in whichever field this endpoint reads it from.
      const field = tool.primary.type === 'video' ? 'video_url' : app.studio.imageField;
      const value = params[field];
      const urls = Array.isArray(value) ? value : [value];
      expect(urls, `${field} carries the uploaded ${tool.primary.type}`).toContain(tool.primary.type === 'video' ? VID : IMG);

      // Second input, when the app has one: a video, or an end frame.
      if (tool.secondary?.type === 'video') expect(params.video_url, 'second video').toBe(VID);
      if (tool.secondary?.type === 'frame') {
        const all = JSON.stringify(params);
        expect(all, 'end frame reaches the request').toContain(END);
      }
      // Every field this endpoint requires is present and non-empty.
      for (const f of app.endpoint.requiredFields || []) {
        expect(params[f], `required field ${f}`).toBeTruthy();
      }
    });
  }
});

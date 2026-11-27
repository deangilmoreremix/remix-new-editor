// The extra settings the Edit Studio apps offer must be ones the model's live API really accepts.
import { describe, test, expect } from 'vitest';
import modelControls from '../data/muapiAppModelControls.json';
import live from '../lib/muapi/liveModels.json';
import { EDIT_APPS } from '../lib/muapiEditApps.js';
import liveInputs from './fixtures/muapi-live-input-fields.json';

const liveByName = new Map(live.models.map((m) => [m.name, m]));
const entries = Object.entries(modelControls).filter(([k]) => !k.startsWith('_'));

describe('muapiAppModelControls.json matches the live API schema', () => {
  for (const [model, settings] of entries) {
    test(model, () => {
      const schema = liveByName.get(model);
      expect(schema, `${model} is in liveModels.json`).toBeTruthy();
      for (const [key, o] of Object.entries(settings)) {
        const field = schema.fields.find((f) => f.name === key);
        expect(field, `${model}.${key} is a field of the model`).toBeTruthy();
        expect(o.options.length).toBeGreaterThan(0);
        if (field.enum) for (const v of o.options) expect(field.enum, `${model}.${key}=${v}`).toContain(v);
        else if (field.type === 'boolean') for (const v of o.options) expect(typeof v).toBe('boolean');
        else if (field.min !== undefined) for (const v of o.options) expect(v >= field.min && v <= field.max, `${model}.${key}=${v}`).toBe(true);
        if (o.default !== undefined) expect(o.options).toContain(o.default);
      }
    });
  }
});

describe('the apps show those settings', () => {
  const byModel = (m) => EDIT_APPS.filter((a) => a.model === m);
  const control = (app, key) => app.controls.find((c) => c.key === key);

  test('Seedance 2 apps do not offer Resolution or High bitrate: the live endpoint does not declare them', () => {
    const apps = byModel('seedance-2-image-to-video');
    expect(apps.length).toBeGreaterThan(20);
    for (const a of apps) {
      const keys = a.controls.map((c) => c.key);
      expect(keys, a.slug).toEqual(expect.arrayContaining(['aspect_ratio', 'duration']));
      expect(keys, a.slug).not.toContain('resolution');
      expect(keys, a.slug).not.toContain('high_bitrate');
    }
  });

  test('an app keeps its own default duration when the list is widened', () => {
    expect(control(EDIT_APPS.find((a) => a.slug === 'app-packshot'), 'duration').default).toBe(8);
    expect(control(EDIT_APPS.find((a) => a.slug === 'app-mukbang'), 'duration').default).toBe(5);
    const d = control(EDIT_APPS.find((a) => a.slug === 'app-clipcut'), 'duration');
    expect(d.options).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(d.default).toBe(10);
  });

  test('Video Face Swap can pick any of 11 faces; Background Remover offers all 9 formats', () => {
    expect(control(EDIT_APPS.find((a) => a.slug === 'app-video-face-swap'), 'target_index').options).toHaveLength(11);
    expect(control(EDIT_APPS.find((a) => a.slug === 'app-video-bg-remover'), 'output_container_and_codec').options).toHaveLength(9);
  });

  test('image apps are untouched', () => {
    const a = EDIT_APPS.find((x) => x.slug === 'app-angles');
    expect(a.controls.map((c) => c.key)).not.toContain('high_bitrate');
  });
});

describe('every setting an app sends is declared by the live catalog', () => {
  test('each model\'s select settings are in its live input_fields', () => {
    for (const app of EDIT_APPS) {
      const declared = liveInputs.models[app.model];
      expect(declared, `${app.model} is in the live fixture`).toBeTruthy();
      for (const c of app.controls.filter((x) => x.type === 'select')) {
        expect(declared, `${app.slug}: ${app.model} declares ${c.key}`).toContain(c.key);
      }
    }
  });
});

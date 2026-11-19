import { describe, it, expect } from 'vitest';
import {
  QUIET_DEFAULTS, COMMON_TIME_ZONES, isHHMM, isValidTimeZone, zoneOffsetMinutes, timeZoneOptions, quietToForm, quietFromForm, cleanQuietHours, browserTimeZone,
} from '../quietHours.js';
import { cleanPreferences, DEFAULT_PREFERENCES } from '../tabsData.js';

describe('quiet hours form <-> jsonb', () => {
  it('validates HH:MM', () => {
    expect(['00:00', '07:05', '23:59'].every(isHHMM)).toBe(true);
    expect(['24:00', '7:00', '12:60', '', null, 'ab:cd'].some(isHHMM)).toBe(false);
  });
  it('disabled / missing stored value gives defaults 22:00-07:00 and the given zone', () => {
    expect(quietToForm(null, 'Asia/Tokyo')).toEqual({ enabled: false, start: '22:00', end: '07:00', timeZone: 'Asia/Tokyo', summary: true });
    expect(QUIET_DEFAULTS).toEqual({ start: '22:00', end: '07:00' });
    expect(quietToForm({ start: 'x', end: '07:00' }, 'UTC').enabled).toBe(false);
  });
  it('loads a stored value, falling back to the browser zone when the zone is missing or invalid', () => {
    expect(quietToForm({ start: '23:00', end: '06:00', timeZone: 'Europe/Paris' }, 'UTC')).toEqual({ enabled: true, start: '23:00', end: '06:00', timeZone: 'Europe/Paris', summary: true });
    expect(quietToForm({ start: '23:00', end: '06:00', utcOffsetMinutes: 60 }, 'Asia/Tokyo').timeZone).toBe('Asia/Tokyo');
    expect(quietToForm({ start: '23:00', end: '06:00', timeZone: 'Nope/Zone' }, 'UTC').timeZone).toBe('UTC');
  });
  it('summary: old rows without the key read as on; false round-trips; the form saves an explicit boolean', () => {
    expect(quietToForm({ start: '22:00', end: '07:00', timeZone: 'UTC' }, 'UTC').summary).toBe(true);
    expect(quietToForm({ start: '22:00', end: '07:00', timeZone: 'UTC', summary: false }, 'UTC').summary).toBe(false);
    expect(quietToForm(null, 'UTC').summary).toBe(true);
    const off = quietFromForm({ enabled: true, start: '22:00', end: '07:00', timeZone: 'UTC', summary: false });
    expect(off.value.summary).toBe(false);
    expect(quietFromForm({ enabled: true, start: '22:00', end: '07:00', timeZone: 'UTC' }).value.summary).toBe(true);
    expect(quietFromForm({ enabled: false, summary: false }).value).toBeNull();
    expect(cleanQuietHours({ start: '22:00', end: '07:00', summary: false })).toEqual({ start: '22:00', end: '07:00', summary: false });
    expect(cleanQuietHours({ start: '22:00', end: '07:00', summary: 'no' })).toEqual({ start: '22:00', end: '07:00' });
    expect(cleanPreferences({ ...DEFAULT_PREFERENCES, quiet_hours: { start: '22:00', end: '07:00', summary: false } }).quiet_hours.summary).toBe(false);
  });
  it('unchecked stores null', () => {
    expect(quietFromForm({ enabled: false, start: '22:00', end: '07:00', timeZone: 'UTC' })).toEqual({ value: null, error: null, same: false });
  });
  it('enabled stores start, end, timeZone and the offset at save time (DST aware)', () => {
    const winter = quietFromForm({ enabled: true, start: '22:00', end: '07:00', timeZone: 'America/New_York' }, new Date('2026-01-15T12:00:00Z'));
    expect(winter.value).toEqual({ start: '22:00', end: '07:00', timeZone: 'America/New_York', utcOffsetMinutes: -300, summary: true });
    const summer = quietFromForm({ enabled: true, start: '22:00', end: '07:00', timeZone: 'America/New_York' }, new Date('2026-07-15T12:00:00Z'));
    expect(summer.value.utcOffsetMinutes).toBe(-240);
    expect(quietFromForm({ enabled: true, start: '09:00', end: '17:00', timeZone: 'Asia/Kolkata' }).value.utcOffsetMinutes).toBe(330);
  });
  it('rejects invalid times and flags start == end as off', () => {
    expect(quietFromForm({ enabled: true, start: '', end: '07:00', timeZone: 'UTC' }).error).toMatch(/times like 22:00/);
    expect(quietFromForm({ enabled: true, start: '25:00', end: '07:00', timeZone: 'UTC' }).value).toBeNull();
    const same = quietFromForm({ enabled: true, start: '08:00', end: '08:00', timeZone: 'UTC' });
    expect(same.same).toBe(true);
    expect(same.error).toBeNull();
  });
  it('an invalid zone in the form falls back to the browser zone', () => {
    expect(quietFromForm({ enabled: true, start: '22:00', end: '07:00', timeZone: 'Nope' }).value.timeZone).toBe(browserTimeZone());
  });
  it('zones: validity, offsets, option list', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Mars/Base')).toBe(false);
    expect(zoneOffsetMinutes('Mars/Base')).toBe(0);
    expect(zoneOffsetMinutes('UTC', new Date('2026-06-01T00:00:00Z'))).toBe(0);
    expect(timeZoneOptions(['Pacific/Fiji'], { supportedValuesOf: () => { throw new Error('no'); } }).slice(0, COMMON_TIME_ZONES.length)).toEqual([...COMMON_TIME_ZONES]);
    expect(timeZoneOptions(['Pacific/Fiji'], {})).toContain('Pacific/Fiji');
    expect(timeZoneOptions(['Not/AZone'], {})).not.toContain('Not/AZone');
    expect(timeZoneOptions([], { supportedValuesOf: () => ['Europe/Paris', 'Asia/Tokyo'] })).toEqual(['Europe/Paris', 'Asia/Tokyo']);
  });
  it('cleanQuietHours / cleanPreferences keep the new fields but stay compatible with the old shape', () => {
    expect(cleanQuietHours({ start: '22:00', end: '07:00' })).toEqual({ start: '22:00', end: '07:00' });
    expect(cleanQuietHours({ start: '22:00', end: '07:00', timeZone: 'Europe/Paris', utcOffsetMinutes: 60 })).toEqual({ start: '22:00', end: '07:00', timeZone: 'Europe/Paris', utcOffsetMinutes: 60 });
    expect(cleanQuietHours({ start: '22:00', end: '07:00', timeZone: 'Nope' })).toEqual({ start: '22:00', end: '07:00' });
    expect(cleanQuietHours({ start: '22:00', end: 'x' })).toBeNull();
    expect(cleanPreferences({ ...DEFAULT_PREFERENCES, quiet_hours: { start: '22:00', end: '07:00', timeZone: 'Asia/Tokyo', utcOffsetMinutes: 540 } }).quiet_hours).toEqual({ start: '22:00', end: '07:00', timeZone: 'Asia/Tokyo', utcOffsetMinutes: 540 });
  });
});

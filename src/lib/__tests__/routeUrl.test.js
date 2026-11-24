import { describe, it, expect } from 'vitest';
import { parseLocation, buildUrl, routeHash } from '../routeUrl.js';

const loc = (pathname = '/', search = '', hash = '') => ({ pathname, search, hash });

describe('parseLocation', () => {
  it('reads a clean path', () => {
    expect(parseLocation(loc('/cinema-template'))).toEqual({ page: 'cinema-template', params: {}, legacy: false });
  });
  it('reads nested paths and ignores trailing slashes', () => {
    expect(parseLocation(loc('/template/abc/')).page).toBe('template/abc');
    expect(parseLocation(loc('/academy/track/x/lesson/1')).page).toBe('academy/track/x/lesson/1');
  });
  it('reads the legacy hash route', () => {
    expect(parseLocation(loc('/', '', '#/image'))).toEqual({ page: 'image', params: {}, legacy: true });
  });
  it('reads the query that the router writes before the hash', () => {
    expect(parseLocation(loc('/', '?template=7&mode=x', '#/image'))).toEqual({
      page: 'image', params: { template: '7', mode: 'x' }, legacy: true,
    });
  });
  it('reads a query inside the hash, which wins over the real query', () => {
    expect(parseLocation(loc('/', '?asset=1&k=v', '#/edit?asset=7')).params).toEqual({ asset: '7', k: 'v' });
    expect(parseLocation(loc('/', '', '#/edit?asset=7')).page).toBe('edit');
  });
  it('keeps public player paths as paths, in either form', () => {
    expect(parseLocation(loc('/watch/abc')).page).toBe('watch/abc');
    expect(parseLocation(loc('/v/biz/slug')).page).toBe('v/biz/slug');
    expect(parseLocation(loc('/', '', '#/p/slug')).page).toBe('p/slug');
  });
  it('drops a second # after the route', () => {
    expect(parseLocation(loc('/', '', '#/studios/x#features')).page).toBe('studios/x');
  });
  it('ignores in-page anchors; the pathname decides', () => {
    expect(parseLocation(loc('/', '', '#features')).page).toBe('landing');
    expect(parseLocation(loc('/studios/foo/', '', '#features')).page).toBe('studios/foo');
    expect(parseLocation(loc('/', '', '#')).page).toBe('landing');
  });
  it('a hash route wins over the pathname', () => {
    expect(parseLocation(loc('/signin', '', '#/image')).page).toBe('image');
  });
  it('treats the root and index.html as landing', () => {
    expect(parseLocation(loc('/')).page).toBe('landing');
    expect(parseLocation(loc('/index.html')).page).toBe('landing');
  });
});

describe('buildUrl', () => {
  it('builds clean paths with an optional query', () => {
    expect(buildUrl('cinema-template')).toBe('/cinema-template');
    expect(buildUrl('image', { template: '7' })).toBe('/image?template=7');
    expect(buildUrl('academy/track/a/lesson/2')).toBe('/academy/track/a/lesson/2');
    expect(buildUrl('landing')).toBe('/');
  });
});

describe('routeHash', () => {
  it('gives a #/page string for either URL form', () => {
    expect(routeHash(loc('/timeline'))).toBe('#/timeline');
    expect(routeHash(loc('/', '?a=1', '#/timeline'))).toBe('#/timeline');
    expect(routeHash(loc('/'))).toBe('');
  });
});

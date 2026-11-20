// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

beforeAll(() => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

// ---- the AI copy service and the MuAPI account list are controlled by the tests ----
const generateCopyMock = vi.hoisted(() => vi.fn());
vi.mock('@ohb/shared/api/socialCopyService', async () => {
  const actual = await vi.importActual<any>('@ohb/shared/api/socialCopyService');
  return { ...actual, generateCopy: generateCopyMock };
});

const listMock = vi.hoisted(() => vi.fn());
vi.mock('@ohb/lib/muapi', async () => {
  const actual = await vi.importActual<any>('@ohb/lib/muapi');
  return { ...actual, listExternalSocialAccounts: listMock };
});

import { WriteStep } from '../WriteStep';
import DestinationsStep from '../DestinationsStep';

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.clearAllMocks();
});
const mount = (node: React.ReactElement) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
};
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('WriteStep variant slots', () => {
  it('shows the generated variants even when the copy arrived with a master post but no variant slots', async () => {
    generateCopyMock.mockResolvedValue({ masterPost: 'Hello world', variants: ['One', 'Two', 'Three'], youtube: {}, instagram: {}, tiktok: {} });
    const updates: any[] = [];
    mount(
      <WriteStep
        asset={{ type: 'video', url: 'https://cdn.example.com/a.mp4', title: 'My launch' } as any}
        copy={{ master: 'My launch', platforms: {}, variants: [] } as any}
        onUpdateCopy={(c) => updates.push(c)}
      />,
    );
    const writePost = [...document.querySelectorAll('button')].find((b) => /Write Post/.test(b.textContent || '')) as HTMLButtonElement;
    expect(writePost).toBeTruthy();
    await act(async () => { writePost.click(); });
    await flush();
    const generated = updates.find((u) => (u.variants || []).some((v: any) => v.text));
    expect(generated, 'an update with variant text').toBeTruthy();
    expect(generated.variants.map((v: any) => v.text)).toEqual(['One', 'Two', 'Three']);
  });
});

describe('DestinationsStep account lists', () => {
  const props = (over: Record<string, unknown> = {}) => ({
    asset: { type: 'video', url: 'https://cdn.example.com/a.mp4' },
    copy: { master: 'x', platforms: {}, variants: [] },
    destinations: [],
    onChange: vi.fn(),
    publishResults: [],
    onPublish: vi.fn(),
    onUpdatePublishResults: vi.fn(),
    publishing: false,
    apiKey: 'key',
    mediaType: 'video',
    ...over,
  }) as any;

  it('does not show (or let you select) a slow answer for a platform you already left', async () => {
    const waiting: Record<string, (v: unknown) => void> = {};
    const accounts = (platform: string, id: number) => [{ id, account_id: id, platform_name: platform, name: `${platform} main` }];
    // The first call (YouTube) stays pending; the second (Instagram) answers at once; then the first answers late.
    let call = 0;
    listMock.mockImplementation(() => {
      call += 1;
      if (call === 1) return new Promise((resolve) => { waiting.youtube = resolve; });
      return Promise.resolve([...accounts('instagram', 201), ...accounts('youtube', 101)]);
    });
    mount(<DestinationsStep {...props()} />);
    await flush();
    const instagram = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Instagram') as HTMLButtonElement;
    await act(async () => { instagram.click(); });
    await flush();
    // the late YouTube answer arrives now
    await act(async () => { waiting.youtube([...accounts('youtube', 101)]); });
    await flush();
    const text = document.body.textContent || '';
    expect(text).not.toContain('#101'); // the YouTube account is not listed as an Instagram destination
    expect(document.querySelectorAll('[role="checkbox"]').length).toBe(1);
    expect(text).toContain('#201');
  });
});

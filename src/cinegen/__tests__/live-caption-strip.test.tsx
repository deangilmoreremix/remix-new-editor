// [remix] Live captions in the editor while the voice-over recorder runs: on this device by default, the online service only on a click.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LiveCaptionStrip } from '@cinegen/components/edit/live-caption-strip';

type Rec = { processLocally?: boolean; started: number; stopped: number; onresult?: (e: unknown) => void; onend?: () => void };
const made: Rec[] = [];
function install(available: string | null, { install: pack = true }: { install?: boolean } = {}) {
  made.length = 0;
  class R implements Rec {
    started = 0; stopped = 0; processLocally?: boolean; onresult?: (e: unknown) => void; onend?: () => void;
    constructor() { made.push(this); }
    start() { this.started += 1; }
    stop() { this.stopped += 1; }
    static available = available === null ? undefined : vi.fn(async () => available);
    static install = vi.fn(async () => pack);
  }
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = R;
  return R;
}
const say = (text: string, final = false) => made.at(-1)?.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: final })] });
const store = new Map<string, string>();

describe('Live caption strip', () => {
  beforeEach(() => {
    cleanup(); store.clear();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  });
  afterEach(() => { delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition; vi.unstubAllGlobals(); });

  it('shows nothing until a recording starts, and nothing after it stops', async () => {
    install('available');
    const { rerender } = render(<LiveCaptionStrip recording={false} />);
    expect(screen.queryByTestId('live-captions')).toBeNull();
    rerender(<LiveCaptionStrip recording />);
    await waitFor(() => expect(screen.getByTestId('live-captions')).toBeTruthy());
    rerender(<LiveCaptionStrip recording={false} />);
    expect(screen.queryByTestId('live-captions')).toBeNull();
    expect(made[0].stopped).toBeGreaterThan(0);                      // the session ends with the recording
  });

  it('on-device available: starts by itself, processes locally, shows the words live and says the audio stays on the device', async () => {
    install('available');
    render(<LiveCaptionStrip recording />);
    await waitFor(() => expect(made.length).toBe(1));
    expect(made[0].processLocally).toBe(true); expect(made[0].started).toBe(1);
    expect(screen.getByTestId('live-captions').textContent).toContain('the audio stays here');
    say('good morning everyone');
    await waitFor(() => expect(screen.getByTestId('live-caption-text').textContent).toBe('good morning everyone'));
    expect(screen.queryByTestId('live-caption-browser')).toBeNull();
  });

  it('language pack not downloaded: offers the download (and nothing runs until it is there)', async () => {
    const R = install('downloadable');
    render(<LiveCaptionStrip recording />);
    await waitFor(() => expect(screen.getByTestId('live-caption-install')).toBeTruthy());
    expect(made.length).toBe(0);
    (R.available as ReturnType<typeof vi.fn>).mockResolvedValue('available');
    fireEvent.click(screen.getByTestId('live-caption-install'));
    await waitFor(() => expect(made.length).toBe(1));
    expect(made[0].processLocally).toBe(true);
  });

  it('cannot caption on this device: never starts the online service by itself; one click does, with a warning, and it is remembered', async () => {
    install(null);                                                   // a browser with no on-device check
    render(<LiveCaptionStrip recording />);
    await waitFor(() => expect(screen.getByTestId('live-caption-browser')).toBeTruthy());
    expect(made.length).toBe(0);                                     // nothing is listening yet
    fireEvent.click(screen.getByTestId('live-caption-browser'));
    await waitFor(() => expect(made.length).toBe(1));
    expect(made[0].processLocally).toBeUndefined();
    expect(screen.getByTestId('live-captions').textContent).toContain('may send the audio to its provider');
    expect(store.get('remix.liveCaptions.browserService')).toBe('1');
  });

  it('a browser with no speech recognition says so, and Hide closes the strip for this recording', async () => {
    render(<LiveCaptionStrip recording />);
    await waitFor(() => expect(screen.getByTestId('live-captions').textContent).toContain('need a browser with speech recognition'));
    fireEvent.click(screen.getByTestId('live-caption-off'));
    expect(screen.queryByTestId('live-captions')).toBeNull();
  });
});

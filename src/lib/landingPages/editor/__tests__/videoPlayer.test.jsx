import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageContext } from '../context.js';
import { VideoPlayer } from '../components.jsx';

const html = (video_url, preview) => renderToStaticMarkup(
  <PageContext.Provider value={{ page: { id: 'p', title: 'T', video_url }, tokens: {}, handlers: {}, preview }}>
    <VideoPlayer />
  </PageContext.Provider>,
);

describe('VideoPlayer', () => {
  it('plays a just-picked local file (blob:) only in the editor and previews', () => {
    expect(html('blob:https://app.test/abc', true)).toContain('src="blob:https://app.test/abc"');
    expect(html('blob:https://app.test/abc', false)).not.toContain('blob:');
  });
  it('plays https videos on published pages', () => {
    expect(html('https://cdn.test/a.mp4', false)).toContain('src="https://cdn.test/a.mp4"');
    expect(html('http://cdn.test/a.mp4', true)).not.toContain('http://cdn.test');
  });
});

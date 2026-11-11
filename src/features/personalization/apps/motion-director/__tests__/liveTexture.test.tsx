// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { LiveTextureContext, liveTexture, textureOverrides } from '../demosrc/_fixtures/liveTexture';

const Probe: React.FC<{ file: string }> = ({ file }) => <img alt={file} src={liveTexture(file)} />;

describe('live textures', () => {
  it('maps captured pages and crops onto the sample slots', () => {
    const map = textureOverrides(['https://x/page.jpg', 'javascript:alert(1)'], ['https://x/a.jpg', 'https://x/b.jpg']);
    expect(map['projects-full.png']).toBe('https://x/page.jpg');
    expect(map['detail-full.png']).toBe('https://x/page.jpg');
    expect(map['card4.png']).toBe('https://x/a.jpg');
    expect(map['card4-hires.png']).toBe('https://x/a.jpg');
    expect(map['card1.png']).toBe('https://x/b.jpg');
    expect(Object.values(map)).not.toContain('javascript:alert(1)');
    expect(textureOverrides()).toEqual({});
  });

  it('renders the sample texture by default and the capture when provided', () => {
    const { getByAltText, rerender } = render(<Probe file="projects-full.png" />);
    expect(getByAltText('projects-full.png').getAttribute('src')).toContain('motion-studio/textures/live/projects-full.png');
    rerender(
      <LiveTextureContext.Provider value={textureOverrides(['https://x/page.jpg'])}>
        <Probe file="projects-full.png" />
      </LiveTextureContext.Provider>,
    );
    expect(getByAltText('projects-full.png').getAttribute('src')).toBe('https://x/page.jpg');
  });
});

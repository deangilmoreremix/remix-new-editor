// @vitest-environment jsdom
import React, { act } from 'react';
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { Thumbnail } from '@remotion/player';
import { withDemoProps } from '../cards/demoProps';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Plain: React.FC = () => <div>plain recipe</div>;
const Wrapped = withDemoProps(Plain as React.ComponentType<Record<string, unknown>>);

const show = async (props: Record<string, unknown>) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<Thumbnail component={Wrapped} compositionWidth={320} compositionHeight={180} frameToDisplay={0} durationInFrames={30} fps={30} inputProps={props} />);
  });
  for (let i = 0; i < 40 && !/recipe|adapted/.test(host.textContent ?? ''); i++) await act(async () => { await new Promise((r) => setTimeout(r, 25)); });
  // let the adapted component replace the plain one once compiled
  for (let i = 0; i < 20; i++) await act(async () => { await new Promise((r) => setTimeout(r, 25)); });
  const text = host.textContent ?? '';
  root.unmount();
  return text;
};

describe('a clip with adapted source', () => {
  it('plays the adapted component, and the plain recipe when the source is broken', async () => {
    const good = `import React from 'react';\nexport const Plain = (props) => <div>adapted {props.screens?.[0]}</div>;`;
    expect(await show({ adaptedCode: good, adaptedStem: 'Plain', screens: ['p.png'] })).toContain('adapted p.png');
    expect(await show({ adaptedCode: `export const Plain = () => fetch('/x')`, adaptedStem: 'Plain' })).toContain('plain recipe');
    const throws = `export const Plain = () => { throw new Error('x') }`;
    expect(await show({ adaptedCode: throws, adaptedStem: 'Plain' })).toContain('plain recipe');
    expect(await show({})).toContain('plain recipe');
  });
});

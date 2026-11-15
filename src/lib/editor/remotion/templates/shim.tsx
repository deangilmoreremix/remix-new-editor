// Stand-in for `remotion` inside vendored third-party template source (see scripts/templates/build.mjs): everything is re-exported from the
// RemotionUI shim (clip-length useVideoConfig) except `staticFile`, which resolves the few bundled sample assets to inline data URIs
// (so no template needs a file server), and the text-slot component used by templates that have no props of their own.
import React, { createContext, useContext } from 'react';
import { staticFile as realStaticFile } from 'remotion';
import { TEMPLATE_ASSETS } from './assets.generated.js';

export * from '../remotionui/shim';
export const staticFile = (name: string): string => (TEMPLATE_ASSETS as Record<string, string>)[name] ?? realStaticFile(name);

/** Values the customer typed for a template's text slots (keys t1, t2, ...). */
export const TemplateTextContext = createContext<Record<string, unknown>>({});
/** One piece of fixed text in a template that has no props: renders the customer's value for slot `i`, or the original text `d`. */
export function __T({ i, d }: { i: number; d: string }) {
  const o = useContext(TemplateTextContext);
  const v = o[`t${i}`];
  return <>{typeof v === 'string' ? v : d}</>;
}

/** Same for text held in a const inside a component (a hook: call it unconditionally at the top of the component). */
export function __S(i: number, d: string): string {
  const o = useContext(TemplateTextContext);
  const v = o[`t${i}`];
  return typeof v === 'string' ? v : d;
}

/** next/image replacement for the two templates that use it: a plain <img>. */
export function NextImage(props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) {
  const { fill, priority: _p, unoptimized: _u, style, alt, ...rest } = props;
  void _p; void _u;
  return <img alt={alt ?? ''} {...rest} style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style} />;
}

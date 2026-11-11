import { createContext, use } from 'react';

/**
 * The clip's word replacements (template words -> the company's words, lib/textOverrides), for text a
 * recipe animates word by word or letter by letter: the DOM swap cannot match text split across spans,
 * so the animating component looks the words up before it splits them.
 */
export const TextMapContext = createContext<Readonly<Record<string, string>>>({});

/** `text` as this clip says it (the replacement when the clip has one). Call during render. */
export function useClipText(text: string | undefined): string {
  const map = use(TextMapContext);
  const t = text ?? '';
  return map[t] ?? map[t.trim()] ?? t;
}

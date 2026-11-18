// SPDX-License-Identifier: AGPL-3.0-or-later — OpenChatCut i18n/locale.ts, vendored in spirit.
// [remix] English only (decision: caption translation only, no UI translation): `useT` returns their English dictionary lookup,
// including `{n}` interpolation as in their locale.ts.
import { t as lookup } from './t';

export type TFn = (zh: string, vars?: Record<string, string | number>) => string;

export const translate: TFn = (zh, vars) => {
  const s = lookup(zh);
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`)) : s;
};

// [remix] `t` as a plain function (their locale.ts exports it too)
export const t = translate;

export function useT(): TFn {
  return translate;
}

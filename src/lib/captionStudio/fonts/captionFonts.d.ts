export interface EmbeddedFont { readonly name: string; readonly load: () => Promise<{ faces: { weight: string; style: string; data: string }[] }> }
export const EMBEDDED_FONTS: readonly EmbeddedFont[]
export const FALLBACK_FONT: EmbeddedFont
export type WeightName = 'light' | 'regular' | 'medium' | 'bold' | 'extra-bold'
export const WEIGHTS: Readonly<Record<WeightName, number>>
export function resolveWeight(style?: { weight?: unknown; bold?: boolean }): number
export function embeddedFont(name: unknown): EmbeddedFont | undefined
export function fontAlias(name: string): string
export function fontStack(name: string, tail: string): string
export function loadEmbeddedFont(name: string, opts?: { weight?: number | string; italic?: boolean; text?: string }): Promise<boolean>

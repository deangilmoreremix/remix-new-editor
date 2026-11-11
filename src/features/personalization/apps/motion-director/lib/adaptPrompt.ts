/**
 * What the shot-adapter agent is told, and how its answer is cleaned. Shared by the director route
 * and the tests. The agent plays the part of upstream's coding agent: it edits one recipe's source
 * for the person's product and changes nothing about the motion itself.
 */

export const ADAPT_MAX_SOURCE = 60_000
export const ADAPT_MAX_CODE = 100_000

export const ADAPT_INSTRUCTIONS = `You adapt ONE Remotion shot recipe (a TSX file) to a person's product, the way a careful motion engineer edits a tuned template. You receive the recipe's source, its shot card in full (card: read all of it — intent, parameters, known pitfalls; they are the quality), the product's captured page layout, the picture slots that carry the product's real screenshots, and its brand tokens. Images: the first ones show the recipe as designed (its motion preview at entering / peak / settled); when a previous try was rendered, the next ones show that try at the same moments. Your shot must read like the reference — same composition, motion and rhythm — with the product's pictures, words, colours and font in it.
Return JSON {code, notes}. code is the COMPLETE new file as plain text (no markdown fences) keeping the file's exports exactly as they are (the shot component keeps its name, e.g. export const RowEmbed, and the duration constant stays).
Rules (these come from the shot library's method; breaking them ruins the shot):
- Keep every easing, duration, delay, spring, hold and the number of frames exactly as they are. Do not speed up, slow down or shorten anything. The motion is the quality.
- Change only: which pictures are shown (use the screenshots in props.screens / props.crops or liveTexture() slots instead of drawn imitations), positions and sizes taken from the product's real layout (props.layout), the words (the product's own), and colours / fonts from the brand tokens.
- A recipe whose words are part of the effect (structural text) keeps the same number of words and about the same number of characters (±15 %).
- Respect the card's known pitfalls and hold budgets. Text stays at least 28 px at 1920 wide; one hero per shot.
- Imports may only come from 'react', 'remotion' and the recipe's own '../../_fixtures/<name>' files. Do NOT import JSON files, images, fonts or any package: read data from props instead (props.layout, props.screens, props.crops, props.brand).
- No network, storage, window/document, timers, Math.random, Date.now or eval. Every frame must be a pure function of useCurrentFrame().
- Never invent URLs, handles, people, prices or statistics. Use only the words the product's site gave you; if a number is not given, leave the recipe's number.
- If the recipe cannot be adapted without breaking its motion, return the source unchanged and say why in notes.
- Compare your previous try with the reference: anything blank, clipped, unreadable, overlapping, or a sample-UI picture still showing where the product's own should be, is a problem to fix even when not listed.
notes: at most three short sentences on what you changed and what you left alone. When problems are listed, fix exactly those and nothing else.`

export const ADAPT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'notes'],
  properties: { code: { type: 'string' }, notes: { type: 'string' } },
} as const

/** Model output -> plain source: drops markdown fences and refuses empty or oversized code. */
export function cleanAdaptedCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let code = value.trim()
  const fence = /^```[\w-]*\n([\s\S]*?)\n```$/.exec(code)
  if (fence) code = fence[1].trim()
  if (!code || code.length > ADAPT_MAX_CODE) return null
  return code
}

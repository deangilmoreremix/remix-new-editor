import type { CardDef } from "./types";
import { textBasicCard } from "./text-basic";
import { titleCardCard } from "./inkpress/title-card";
import { captionStripCard } from "./inkpress/caption-strip";
import { flashCutCard } from "./inkpress/flash-cut";
import { connectedSeamCard } from "./connectedSeam";
import { seamBarnCard, seamDipCard, seamGlitchCard, seamInkCard, seamIrisCard, seamLeakCard, seamLineCard, seamPortalCard, seamWhipCard, seamWipeCard } from "./inkpress/seam-cuts";
import { audioClipCard, imageClipCard, videoClipCard } from "./media-cards";
import { siteInsetCard } from "./site-inset";
import { BRAND_SCENE_CARDS } from "./brand-scenes";
import { BG_CARDS } from "./background-cards";
import { DEMO_CARDS } from "./demoCards";
import { PROJECT_CARDS } from "./projectCards";
import { buildCardRegistry } from "./buildRegistry";
import { LEGACY_CARDS } from "./legacyCards";

/** Card registry — first id wins:
 *  - native Motion Studio cards: text / Ink Press title card / caption strip / white-flash cut
 *  - media cards: audio / video / image (project public/ and the SFX library use them)
 *  - background cards
 *  - film-project unit cards from a linked workbench.ts manifest (only when one is linked)
 *  - motion library: the 151 registered demo components in demosrc/ (157 .tsx files:
 *    151 shots + the 6 shared `_fixtures/` helpers; static index from scripts/gen-motion-studio-index.mjs)
 *  Upstream's 66 retired demo ids are kept as hidden compatibility cards (cards/legacyCards.ts) so an old
 *  project save or imported JSON that names one still plays; they are not in the library. */
const ALL: CardDef[] = [
  textBasicCard,
  titleCardCard,
  captionStripCard,
  flashCutCard,
  connectedSeamCard,
  seamWipeCard,
  seamBarnCard,
  seamDipCard,
  seamWhipCard,
  seamInkCard,
  seamLeakCard,
  seamPortalCard,
  seamIrisCard,
  seamLineCard,
  seamGlitchCard,
  audioClipCard,
  videoClipCard,
  imageClipCard,
  siteInsetCard,
  ...BRAND_SCENE_CARDS,
  ...BG_CARDS,
  ...PROJECT_CARDS,
  ...DEMO_CARDS,
];

const registry = buildCardRegistry(ALL, LEGACY_CARDS);
export const CARD_LIST: CardDef[] = registry.cardList;
export const CARDS: Record<string, CardDef> = registry.cards;

// Demo components — clickable MiniMax / Academy demos with a
// "Create This Style" path into the studios (roadmap §2).
//
//   DemoCard         reusable card (rail | grid | hero)
//   DemoDetailModal  full player + extracted style params + tweakable prompt
//   DemoRail         rail/grid that owns the open-demo state
//   createDemoRail   vanilla-DOM mount for the studio factories

export { DemoCard, default as DemoCardDefault } from './DemoCard.jsx';
export { DemoDetailModal } from './DemoDetailModal.jsx';
export { DemoRail, createDemoRail } from './DemoRail.jsx';
export {
  describeAsset,
  toMediaDemo,
  assetSlug,
  sourceLabel,
  sourceTone,
} from './assetShape.js';

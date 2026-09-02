// Lean writing-tonality catalog for social media copy.
// Source: GTM Skills repo (https://gtm-skills.com/free-tools/tonalities/<slug>),
// specifically each tonality's verbatim description/tagline — that is the
// authoritative, right-sized voice cue for a one-click social-copy enhance.
//
// NOTE: the repo also ships full sales-scenario templates (Cold Email, Discovery
// Call, Objection, LinkedIn) and per-scenario style rules. Those belong to the
// GTM "write a sales artifact" flow, NOT social posting, so they are intentionally
// excluded here to keep the enhancer bundle small and the prompt tokens focused.
//
// Fields:
//   - id          : repo slug (used to select a tonality)
//   - label       : human-readable name shown in the modal dropdown
//   - description : verbatim repo tagline — sent to the model as the voice cue
//   - premium     : true for the 12 premium tonalities

export const TONALITIES = [
  {
    "id": "steve-jobs",
    "label": "Steve Jobs",
    "description": "Command attention with short, declarative sentences. No corporate jargon. High emotional intensity.",
    "premium": false
  },
  {
    "id": "jeff-bezos",
    "label": "Jeff Bezos",
    "description": "The six-pager philosophy. Working backwards from the customer. Data woven into compelling stories.",
    "premium": false
  },
  {
    "id": "chris-voss",
    "label": "Chris Voss",
    "description": "Labeling emotions, mirroring, no-oriented questions. Psychology-driven communication.",
    "premium": false
  },
  {
    "id": "seth-godin",
    "label": "Seth Godin",
    "description": "Be remarkable or be invisible. Short, punchy insights. Ideas that spread. Permission marketing.",
    "premium": false
  },
  {
    "id": "hemingway",
    "label": "Hemingway",
    "description": "One idea per sentence. Show, don't tell. The Iceberg Theory—90% below the surface.",
    "premium": false
  },
  {
    "id": "cormac-mccarthy",
    "label": "Cormac McCarthy",
    "description": "Poetic rhythm. Sparse punctuation. Framing as destiny, not opinion. Unforgettable.",
    "premium": false
  },
  {
    "id": "challenger",
    "label": "Challenger Sale",
    "description": "Lead with commercial insight. Challenge assumptions. Create constructive tension.",
    "premium": false
  },
  {
    "id": "value-based",
    "label": "Value-Based",
    "description": "Quantify everything. Build business cases. Make the ROI so obvious that price becomes irrelevant.",
    "premium": false
  },
  {
    "id": "trusted-advisor",
    "label": "Trusted Advisor",
    "description": "Build trust through credibility, reliability, and low self-orientation. Long-term over short-term.",
    "premium": false
  },
  {
    "id": "pain-point-research",
    "label": "Pain Point Research",
    "description": "Go beyond surface symptoms. Uncover root causes, business impact, and personal stakes.",
    "premium": false
  },
  {
    "id": "meddic",
    "label": "MEDDIC/MEDDPICC",
    "description": "Metrics, Economic Buyer, Decision Criteria, Decision Process, Champion, Competition.",
    "premium": false
  },
  {
    "id": "socratic",
    "label": "Socratic Selling",
    "description": "Lead with questions, not pitches. Guide prospects to discover insights themselves.",
    "premium": false
  },
  {
    "id": "warren-buffett",
    "label": "Warren Buffett",
    "description": "Simple language, Midwestern humility, long-term thinking. Build trust with skeptical buyers.",
    "premium": true
  },
  {
    "id": "alex-hormozi",
    "label": "Alex Hormozi",
    "description": "Direct, math-driven, value stacking. Make the offer so good saying no feels stupid.",
    "premium": true
  },
  {
    "id": "naval-ravikant",
    "label": "Naval Ravikant",
    "description": "Philosophical depth in few words. Reframe problems at their root. Leverage thinking.",
    "premium": true
  },
  {
    "id": "david-ogilvy",
    "label": "David Ogilvy",
    "description": "Research-backed, headline-driven, benefit-focused. The father of modern advertising.",
    "premium": true
  },
  {
    "id": "spin-selling",
    "label": "SPIN Selling",
    "description": "Structured discovery: Situation, Problem, Implication, Need-Payoff. Research-validated.",
    "premium": true
  },
  {
    "id": "gap-selling",
    "label": "Gap Selling",
    "description": "Current state to future state. The gap IS the value. Quantify the cost of inaction.",
    "premium": true
  },
  {
    "id": "sandler",
    "label": "Sandler Selling",
    "description": "Negative reverse, pattern interrupts, be okay with no. Let prospects convince themselves.",
    "premium": true
  },
  {
    "id": "command-of-message",
    "label": "Command of Message",
    "description": "Required Capabilities, Positive Business Outcomes. Structured value articulation.",
    "premium": true
  },
  {
    "id": "competitive-displacement",
    "label": "Competitive Displacement",
    "description": "Respectful but surgical. Unseat incumbents by finding the wedge and reducing switch friction.",
    "premium": true
  },
  {
    "id": "executive-briefing",
    "label": "Executive Briefing",
    "description": "Top-down structure, strategic framing, BLUF. Respect C-suite time and intelligence.",
    "premium": true
  },
  {
    "id": "win-back",
    "label": "Win-Back Campaign",
    "description": "Acknowledge the past, show what's changed, low-pressure return. For churned accounts.",
    "premium": true
  },
  {
    "id": "expansion-upsell",
    "label": "Expansion & Upsell",
    "description": "Leverage existing success to grow accounts. Frame expansion as the natural next step.",
    "premium": true
  }
];

// Look up a single tonality by id (returns null if not found).
export function getTonality(id) {
  return TONALITIES.find((t) => t && t.id === id) || null;
}

export default TONALITIES;

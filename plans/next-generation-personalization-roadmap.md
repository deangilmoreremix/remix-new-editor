# Next-Generation Personalization Engine — Strategic Roadmap

**Version:** 1.0  
**Date:** 2026-08-23  
**Owner:** Engineering / Product / Design  
**Status:** Proposed  
**Time Horizon:** 18 months (6 quarters)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Vision: The Adaptive Personalization Engine](#3-vision-the-adaptive-personalization-engine)
4. [Design Principles for 2026](#4-design-principles-for-2026)
5. [Technical Architecture: Target State](#5-technical-architecture-target-state)
6. [Generative AI Framework](#6-generative-ai-framework)
7. [Implementation Phases](#7-implementation-phases)
8. [UX/UI Roadmap](#8-uxui-roadmap)
9. [Data & Privacy Strategy](#9-data--privacy-strategy)
10. [Success Metrics](#10-success-metrics)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Dependencies & Resourcing](#12-dependencies--resourcing)

---

## 1. Executive Summary

The current personalization system is **functionally mature at the prompt layer** but **incomplete at the content delivery layer**. Token replacement, contact intelligence, and AI enrichment work well for text generation, but video personalization is specified rather than implemented, client state is siloed in `localStorage`, and personalization is reactive rather than predictive.

This roadmap transforms the platform from a **token-replacement tool** into an **Adaptive Personalization Engine (APE)** — a system that:
- **Generates** personalized content across modalities (text, image, video, audio, interactive) in real time
- **Adapts** to user behavior, context, and implicit signals without manual token configuration
- **Predicts** optimal personalization strategies using generative AI and behavioral models
- **Delivers** seamlessly across the entire SmartVideo studio ecosystem

**Strategic bet:** By Q4 2026, the platform will shift from "user applies tokens to prompts" to "system generates personalized experiences by default," with user override as the escape hatch.

---

## 2. Current State Assessment

### 2.1 What Works Well
| Area | Status | Evidence |
|------|--------|----------|
| Token resolution engine | ✅ Production-ready | `tokenSchema.js` 3-tier fallback, 23 canonical tokens, alias tolerance |
| Contact discovery pipeline | ✅ Functional | Maigret + GitHub + website crawl → structured JSON |
| AI enrichment | ✅ Robust | OpenAI structured JSON schema + Gemini fallback + scan-derived fallback |
| Cross-app handoff | ✅ Implemented | `/send-to-app` envelope with project + scan + output |
| Popcorn.js image overlay | ✅ Integrated | `PERSONALIZED_IMAGE` plugin with token-aware `src`/`linkSrc` |
| Personalized voice | ✅ Wired | `PERSONALIZED_VOICE` asset type, dedicated API paths |

### 2.2 Critical Gaps
| Gap | Impact | Severity |
|-----|--------|----------|
| **Video rendering pipeline** | Batch personalization produces no actual video files | 🔴 Blocker |
| **localStorage-only client state** | No cross-device sync, quota limits, private-mode failure | 🟡 High |
| **No real-time adaptation** | Personalization is static after token replacement | 🟡 High |
| **No implicit signal capture** | System doesn't learn from user behavior | 🟡 High |
| **No A/B testing framework** | Cannot optimize personalization strategies | 🟡 Medium |
| **No privacy layer** | Raw contact data stored client-side without consent management | 🟡 Medium |
| **No progressive disclosure** | Personalization UI is modal-heavy, not context-aware | 🟡 Medium |
| **No offline personalization** | Requires network for every token resolution | 🟢 Low |

### 2.3 Technical Debt
- Dual Supabase clients (`lib/supabase.js` stub vs `hybrid-supabase.js` real)
- `personalizer-api.js` is 1,330 lines in a single Netlify function (no module splitting)
- `PersonalizeModal.jsx` is 1,650+ lines with inline CSS (should be componentized)
- No TypeScript on backend functions (JavaScript only)
- Rate limiting uses discovery table as proxy (semantic mismatch)

---

## 3. Vision: The Adaptive Personalization Engine

### 3.1 Core Concept

The APE treats every piece of content as a **personalization template** by default. Instead of users manually inserting `{{firstName}}` tokens, the system:

1. **Infers** contact/audience segments from context (CRM sync, email integration, manual upload)
2. **Generates** variant content using multimodal AI (text, image, video, audio) tailored to each segment
3. **Adapts** delivery based on real-time signals (device, location, time, engagement history)
4. **Learns** from feedback loops (what gets watched, clicked, replied to)
5. **Optimizes** via automated A/B testing and reinforcement learning

### 3.2 Target User Experience

**Before (Current):**
> User uploads CSV → manually maps tokens → clicks "Generate Videos" → waits → downloads batch → sends manually

**After (Target):**
> User records base video → selects "Personalize for Sales" → system auto-discovers contacts from CRM → AI generates personalized variants per contact → system schedules sends via integrated email → optimizes send times based on engagement → user reviews analytics dashboard

### 3.3 Strategic Pillars

| Pillar | Description | Q2 2026 Target | Q4 2026 Target |
|--------|-------------|----------------|----------------|
| **Generative Personalization** | AI-generated content per user/segment | Script personalization | Full video/audio/image personalization |
| **Adaptive Delivery** | Real-time content adaptation | Token replacement | Context-aware dynamic assembly |
| **Predictive Intelligence** | Anticipate personalization needs | Manual discovery | Auto-discovery + predictive suggestions |
| **Privacy & Control** | User sovereignty over personalization | Basic token opt-out | Granular consent + zero-party data |
| **Cross-Studio Sync** | Personalization everywhere | 2-3 studios | All 16 studios + timeline + render |

---

## 4. Design Principles for 2026

### 4.1 UX Principles

#### P1: Zero-Configuration Personalization
Personalization should be the **default state**, not a feature to opt into. Every content creation flow should ask "Who is this for?" before "What do you want to create?"

**Implementation:**
- New projects default to "Personalized" mode with auto-detected audience
- Token insertion is proactive: system suggests tokens based on contact intelligence
- "Skip personalization" is the explicit opt-out, not the starting point

#### P2: Contextual Surfaces
Personalization controls should appear **where and when they are needed**, not buried in modals.

**Implementation:**
- Inline token chips in prompt textareas (already implemented)
- Floating personalization palette docked to timeline
- Context bar showing active contact/profile in studio header
- Right-click context menu on any element → "Personalize for..."

#### P3: Progressive Disclosure
The system should hide complexity until the user needs it.

**Implementation:**
- **Tier 1 (Default):** System suggests 3-5 best tokens based on contact data
- **Tier 2 (Expand):** User clicks "More tokens" → full token palette
- **Tier 3 (Advanced):** User clicks "Custom tokens" → token editor + variables builder
- **Tier 4 (Expert):** User clicks "Raw mode" → direct JSON variable editing

#### P4: Transparency & Explainability
Users must understand **why** content is personalized a certain way.

**Implementation:**
- "Personalized because..." tooltips on generated content
- Token resolution preview panel showing source of each value
- Audit trail: "This video was personalized for John using: firstName, company, painPoint"
- One-click "Reset to default" to see non-personalized version

#### P5: Consent-First Design
Personalization should feel like a **gift**, not surveillance.

**Implementation:**
- Contact cards show data source (Maigret, manual, CRM) with confidence score
- "Forget this contact" permanently purges all associated data
- Granular toggle: allow/disallow per data source
- Time-limited personalization: "Only use this data for this session"

#### P6: Frictionless Iteration
Users should be able to **refine** personalization in seconds, not minutes.

**Implementation:**
- Quick-switch contact dropdown in studio chrome
- "Personalize for similar contacts" one-click variant generation
- Live preview: change contact → see content update in real time
- Undo/redo for personalization changes (leveraging existing undo stack)

### 4.2 UI Design System: "Prism"

A new design language for personalization surfaces:

```
Prism Design Tokens
├── Colors
│   ├── --personalize-primary: #d9ff00 (existing studio accent)
│   ├── --personalize-accent: #a855f7 (new: AI-generated indicator)
│   ├── --personalize-success: #22c55e
│   ├── --personalize-warning: #f59e0b
│   └── --personalize-surface: rgba(255,255,255,0.05) (glassmorphic panels)
├── Typography
│   ├── Token chips: 'SF Mono', monospace (14px)
│   ├── Contact names: Inter Variable, 600 weight
│   └── AI suggestions: Italic, 13px, opacity 0.8
├── Motion
│   ├── Token insertion: spring animation (300ms)
│   ├── Contact switch: crossfade (200ms)
│   └── AI generation: shimmer gradient (infinite)
└── Components
    ├── ContactChip (avatar + name + source badge)
    ├── TokenPalette (floating dock with categorized tokens)
    ├── PersonalizationPreview (before/after slider)
    ├── InsightCard (pain point, product, brand color swatch)
    └── GenerateButton (morphs to progress ring during generation)
```

### 4.3 Interaction Patterns

**Pattern 1: The Personalization Dock**
A persistent, collapsible dock at the bottom of every studio showing:
- Active contact (avatar + name)
- Quick token palette (5 most relevant tokens)
- "Auto-personalize" toggle
- Expand arrow to full PersonalizeModal

**Pattern 2: Contextual Injection**
Right-click any text field → "Personalize from contact" → floating token palette near cursor → click token → inserted at cursor

**Pattern 3: Live Variant Preview**
Split-screen: left = base content, right = personalized preview. Updates in real time as contact/token changes.

**Pattern 4: AI Copilot Suggestions**
Subtle inline suggestions: "This prompt could be more specific. Use {{company}} to reference their business."

---

## 5. Technical Architecture: Target State

### 5.1 Target Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Personalize  │  │  Contextual  │  │  Variant     │  │   Insight  │ │
│  │    Dock      │  │  Injection   │  │  Preview     │  │   Cards    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │                 │                  │        │
│  ┌──────▼─────────────────▼─────────────────▼──────────────────▼──────┐ │
│  │                   Personalization Orchestrator                     │ │
│  │  (PersonalizationContextProvider — React Context / EventEmitter)   │ │
│  └──────┬─────────────────┬─────────────────┬────────────────────────┘ │
└─────────┼─────────────────┼─────────────────┼───────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐
│   STUDIO LAYER  │ │   CONTENT       │ │   ADAPTATION                │
│                 │ │   GENERATION    │ │   LAYER                     │
│  • VideoStudio  │ │                 │ │                             │
│  • ImageStudio  │ │  • Prompt       │ │  • Context Engine           │
│  • CinemaStudio │ │    Personalizer │ │    (time, device, location) │
│  • AudioStudio  │ │  • Asset        │ │  • Variant Selector         │
│  • Timeline     │ │    Generator    │ │  • A/B Optimizer            │
│  • Render       │ │  • Scene        │ │  • Feedback Collector       │
│                 │ │    Builder      │ │                             │
└────────┬────────┘ └────────┬────────┘ └──────────┬──────────────────┘
         │                   │                      │
         ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AI / MODEL LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   MuAPI      │  │   OpenAI     │  │   Local/Edge Models      │  │
│  │   Gateway    │  │   Gateway    │  │   (WebGPU/WebAssembly)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                      │
│  ┌──────────────────────────┐  ┌─────────────────────────────────┐  │
│  │    Supabase (Postgres)   │  │    Personalization Graph        │  │
│  │  contacts │ profiles     │  │    (Dgraph / FalkorDB)         │  │
│  │  variables │ assets      │  │                                 │  │
│  │  outputs  │ projects     │  │  Nodes: Contact, Content,        │  │
│  │  settings │ templates    │  │  Token, Segment, Variant         │  │
│  └──────────────────────────┘  │  Edges: USED_IN, GENERATED_BY,  │  │
│                                │  PREFERS, OPTIMIZED_FOR         │  │
│  ┌──────────────────────────┐  └─────────────────────────────────┘  │
│  │    Edge Cache (Redis)     │                                     │
│  │  • Active profiles        │                                     │
│  │  • Token resolutions      │                                     │
│  │  • Variant manifests      │                                     │
│  └──────────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL INTEGRATIONS                           │
│  CRM │ Email │ Slack │ Calendar │ Analytics │ CDN │ Video Encode     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Core New Components

#### 5.2.1 Personalization Orchestrator
**Location:** `src/lib/personalization/orchestrator.js`  
**Responsibility:** Single source of truth for personalization state across all studios.

```javascript
class PersonalizationOrchestrator {
  // Central state
  getActiveContact()           // Current contact/profile
  getActiveSegment()           // Current audience segment
  getResolvedTokens()          // Computed token map
  getContext()                 // Time, device, location, behavior
  
  // Actions
  setActiveContact(contactId)
  applyPersonalization(content, options)
  generateVariants(baseContent, audience)
  recordFeedback(variantId, action)  // viewed, clicked, shared
  
  // Subscription model for reactive UI
  subscribe(callback)
  unsubscribe(callback)
}
```

#### 5.2.2 Context Engine
**Location:** `src/lib/personalization/contextEngine.js`  
**Responsibility:** Capture and expose implicit context signals.

```javascript
const contextEngine = {
  // Signals
  getTimeOfDay()              // morning/afternoon/evening/night
  getDeviceType()             // mobile/tablel/desktop
  getLocation()               // timezone, country (if permitted)
  getEngagementHistory()      // what user interacted with recently
  
  // Adaptation rules
  shouldPersonalize(contentType)  // policy engine
  suggestTokens(contact, content) // AI-suggested tokens
  optimizeForContext(variants)     // reorder/select variants
}
```

#### 5.2.3 Variant Selector & A/B Optimizer
**Location:** `src/lib/personalization/optimizer.js`  
**Responsibility:** Multi-armed bandit / Thompson sampling for variant selection.

```javascript
class VariantOptimizer {
  registerExperiment(experimentId, variants, metrics)
  selectVariant(experimentId, context)      // Thompson sampling
  recordOutcome(experimentId, variantId, metrics)
  getWinner(experimentId)                   // statistical significance
  getConfidence(experimentId)               // 95% CI
}
```

#### 5.2.4 Generative Content Pipeline
**Location:** `src/lib/personalization/generators/`  
**Responsibility:** AI-generated personalized content across modalities.

```
generators/
├── index.js                 # Unified generate() interface
├── text/
│   ├── promptPersonalizer.js    # Prompt-level token replacement + AI rewrite
│   ├── scriptWriter.js          # Personalized video scripts
│   └── emailComposer.js         # Personalized email bodies
├── image/
│   ├── avatarGenerator.js       # AI avatars per contact
│   ├── sceneGenerator.js        # Background scenes per contact
│   └── overlayGenerator.js      # Dynamic image overlays
├── video/
│   ├── templateRenderer.js      # Base video + personalized layers
│   ├── avatarVideo.js           # Talking head per contact
│   └── scenePersonalizer.js     # Scene-level personalization
├── audio/
│   ├── personalizedTTS.js       # TTS with resolved tokens
│   └── voiceCloner.js           # Per-contact voice clone
└── interactive/
    ├── landingPage.js            # Personalized landing pages
    └── ctaPersonalizer.js        # Dynamic CTAs per contact
```

### 5.3 Data Model Extensions

#### 5.3.1 New Supabase Tables

```sql
-- Personalization experiments (A/B tests)
CREATE TABLE personalization_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,  -- 'video', 'image', 'email', 'script'
  base_content_id UUID,        -- reference to base asset
  variants JSONB NOT NULL,     -- [{id, content, metadata}]
  metrics JSONB DEFAULT '{}',  -- {views, clicks, shares, watch_time}
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'complete'
  winner_variant_id UUID,
  confidence_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact segments (audience groups)
CREATE TABLE contact_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL,        -- {industry: ['SaaS'], company_size: ['11-50']}
  contact_ids UUID[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personalization feedback loop
CREATE TABLE personalization_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID,
  content_id UUID,
  variant_id UUID,
  action TEXT NOT NULL,         -- 'viewed', 'clicked', 'shared', 'replied'
  context JSONB DEFAULT '{}',   -- {time_of_day, device, location}
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated content variants
CREATE TABLE content_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  base_content_id UUID,
  contact_id UUID,
  segment_id UUID,
  variant_type TEXT NOT NULL,   -- 'video', 'image', 'script', 'email'
  content JSONB NOT NULL,       -- {url, tokens_applied, generation_params}
  metadata JSONB DEFAULT '{}',
  parent_experiment_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5.3.2 Personalization Graph (FalkorDB / Dgraph)

For relationship-aware personalization:

```
Schema:
  Contact {
    id: ID
    user_id: ID
    segment: [Segment]
    prefers: [Content]
    engaged_with: [Content]
    generated_variant: [ContentVariant]
  }
  
  Content {
    id: ID
    base_template: [Content]
    variant_for: [Contact]
    optimized_in: [Experiment]
  }
  
  Segment {
    id: ID
    contains: [Contact]
    optimized_content: [Content]
  }
  
  Experiment {
    id: ID
    variant: [ContentVariant]
    winner: [ContentVariant]
  }
```

### 5.4 API Layer Redesign

#### 5.4.1 Unified Personalization API

```
POST /api/personalization/v1/context
  → Returns current context (contact, segment, tokens, time, device)

POST /api/personalization/v1/generate
  → Generates personalized content variant
  Body: { baseContentId, contactId, segmentId, modalities, options }
  Response: { variantId, content, tokensApplied, metadata }

POST /api/personalization/v1/optimize
  → Creates/updates A/B experiment
  Body: { experimentId, baseContentId, variants, targetMetrics }

GET /api/personalization/v1/experiments/:id/winner
  → Returns winning variant with confidence interval

POST /api/personalization/v1/feedback
  → Records user interaction
  Body: { variantId, action, context, duration_ms }

GET /api/personalization/v1/suggestions
  → AI-suggested personalization opportunities
  Response: { suggestions: [{type, reason, tokens, confidence}] }
```

#### 5.4.2 Real-Time Updates (WebSocket)

```
WS /personalization/v1/stream
  → Pushes:
    - contact.updates (profile changed)
    - experiment.results (variant metrics updated)
    - suggestions.new (AI found new opportunity)
    - content.ready (async generation complete)
```

---

## 6. Generative AI Framework

### 6.1 The Personalization Model

```
                    ┌──────────────────┐
                    │   Base Content   │
                    │   (Template)     │
                    └────────┬─────────┘
                             │
              ┌──────────────▼──────────────┐
              │     Context Fuser           │
              │  (contact + segment +       │
              │   context + history)        │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   Generative Engine         │
              │  ┌──────────────────────┐   │
              │  │  Intent Parser       │   │
              │  │  (what to personalize│   │
              │  │   and why)           │   │
              │  └──────────┬───────────┘   │
              │  ┌──────────▼───────────┐   │
              │  │  Modality Router     │   │
              │  │  (text/image/video/  │   │
              │  │   audio/interactive) │   │
              │  └──────────┬───────────┘   │
              │  ┌──────────▼───────────┐   │
              │  │  Model Dispatcher    │   │
              │  │  (MuAPI / OpenAI /   │   │
              │  │   local models)      │   │
              │  └──────────┬───────────┘   │
              │  ┌──────────▼───────────┐   │
              │  │  Output Normalizer   │   │
              │  │  (validate, sanitize,│   │
              │  │   format)            │   │
              │  └──────────────────────┘   │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   Variant Assembler         │
              │  (compose multi-modal       │
              │   output, apply tokens,     │
              │   attach metadata)          │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   Optimization Engine       │
              │  (A/B test, bandit select,  │
              │   feedback loop)            │
              └──────────────┬──────────────┘
                             │
                    ┌────────▼────────┐
                    │  Delivered      │
                    │  Experience     │
                    └─────────────────┘
```

### 6.2 Modality-Specific Strategies

#### 6.2.1 Text Personalization
**Current:** Token replacement in prompts  
**Target:** AI-aware prompt rewriting + style adaptation

```javascript
// Before: simple replacement
"Hi {{firstName}}, we help {{company}} with {{painPoint}}"

// After: AI-rewritten with contact context
{
  original: "Hi {{firstName}}, we help {{company}} with {{painPoint}}",
  personalized: "Hi John, I saw Acme Corp is hiring 5 new SDRs — our AI calling platform cuts ramp time by 40%. Worth a 10-min demo?",
  style: "casual",
  tokensUsed: ["firstName", "company", "painPoint"],
  confidence: 0.92
}
```

**Implementation:**
- Use OpenAI `gpt-4o` or `claude-3.5-sonnet` with structured output
- Prompt template includes contact intelligence + tone guidelines + CTA
- Cache generated variants per contact to avoid redundant API calls
- Fallback to token replacement if AI generation fails

#### 6.2.2 Image Personalization
**Current:** Static overlays with token URLs  
**Target:** AI-generated dynamic imagery

```javascript
// Before: fixed placeholder image
options.src = "{{image}}"

// After: AI-generated scene
{
  type: "ai-generated",
  prompt: "Professional headshot of John Doe, CEO of Acme Corp, in modern office, natural lighting",
  style: "cinematic",
  aspectRatio: "16:9",
  model: "flux-dev",
  generatedUrl: "..."
}
```

**Implementation:**
- Use MuAPI `generateImage()` with personalized prompts
- Pre-generate avatar variants per contact at upload time
- Dynamic background generation based on company brand colors
- Caching: store generated images per contact for 24h

#### 6.2.3 Video Personalization
**Current:** Specified but not implemented  
**Target:** Real-time assembled video with personalized layers

**Architecture:**
```
Base Video Template
    │
    ├── Layer 0: Base video (unchanged)
    │
    ├── Layer 1: Personalized text overlays (FFmpeg drawtext)
    │   • {{firstName}} → burned-in subtitle at timestamp 00:02
    │   • {{company}} → lower third at timestamp 00:05
    │
    ├── Layer 2: Personalized image overlays (Popcorn.js / remotion)
    │   • Dynamic avatar/logo at position (x%, y%)
    │   • Token-resolved at render time
    │
    ├── Layer 3: Personalized audio (TTS + voice clone)
    │   • {{firstName}} in spoken text
    │   • Contact-specific voice characteristics
    │
    └── Layer 4: Interactive layer (web video)
        • Clickable CTAs with contact-specific URLs
        • UTM parameters auto-injected
```

**Implementation Options:**
1. **Server-side (FFmpeg):** High quality, slow, expensive
2. **Client-side (Remotion/Canvas):** Fast, interactive, lower quality
3. **Hybrid:** Server renders base layers, client assembles final variant

**Recommendation:** Hybrid approach — server pre-renders base + text overlays, client overlays dynamic image/audio layers via Popcorn.js.

#### 6.2.4 Audio Personalization
**Current:** TTS with token replacement  
**Target:** Voice-cloned, emotionally-contextualized audio

```javascript
{
  text: "Hi {{firstName}}, I recorded this just for you at {{company}}.",
  voice: {
    clone: true,
    referenceAudio: "contact.avatar.0",  // use contact's voice if available
    emotion: "warm" | "professional" | "excited",
    pace: "normal" | "fast" | "slow"
  },
  backgroundMusic: "match_contact_preference"
}
```

### 6.3 Feedback Loop & Learning

```
User Interaction
       │
       ▼
Feedback Collector
  • viewed (impression)
  • watched (completion rate)
  • clicked (CTA)
  • replied (email)
  • shared (viral coefficient)
       │
       ▼
Feature Store
  • contact features (industry, company_size, pain_point)
  • content features (length, modality, tone)
  • context features (time, device, channel)
  • outcome labels (engaged: true/false)
       │
       ▼
Model Trainer (offline, nightly)
  • XGBoost / LightGBM for engagement prediction
  • Multi-armed bandit for variant selection
  • Embedding model for content similarity
       │
       ▼
Optimization Engine
  • Personalization scoring: f(contact, content, context)
  • Token recommendation ranking
  • Content variant selection
  • Send time optimization
```

---

## 7. Implementation Phases

### Phase 1: Foundation & Infrastructure (Q3 2026 — 12 weeks)

**Goal:** Stabilize current system and build the data/API foundation for adaptive personalization.

#### Week 1-2: Technical Debt & Stability
- [ ] Migrate `lib/supabase.js` stub → real Supabase client (or remove entirely)
- [ ] Split `personalizer-api.js` into modular routers:
  - `scan.js` — Maigret + GitHub + website
  - `generate.js` — AI content generation
  - `visual.js` — Visual prompt generation
  - `handoff.js` — Cross-app handoff
  - `export.js` — Multi-format export
- [ ] Extract `PersonalizeModal.jsx` inline CSS → `PersonalizeModal.css` + Prism design tokens
- [ ] Add TypeScript to Netlify functions (`personalizer-api/` and `intelligence-api/`)
- [ ] Audit and fix rate-limiting semantic mismatch (use `personalization_projects` instead of `contact_discoveries`)

#### Week 3-4: Client State Modernization
- [ ] Create `PersonalizationContextProvider` (React Context + EventEmitter bridge)
- [ ] Replace direct `localStorage` reads in studios with context subscriptions
- [ ] Implement `PersonalizationOrchestrator` class (see §5.2.1)
- [ ] Add contact/profile sync: `localStorage` ↔ Supabase via background sync
- [ ] Implement conflict resolution for offline edits

#### Week 5-6: API Modernization
- [ ] Deploy `/api/personalization/v1/context` endpoint
- [ ] Deploy `/api/personalization/v1/generate` with modality routing
- [ ] Add WebSocket stream for real-time updates
- [ ] Implement request deduplication and caching layer (Redis)
- [ ] Add OpenAPI spec for personalization APIs

#### Week 7-8: Database Migration
- [ ] Deploy new tables: `personalization_experiments`, `contact_segments`, `personalization_feedback`, `content_variants`
- [ ] Migrate existing `personalization_projects` data to new schema
- [ ] Add database indexes for common queries
- [ ] Set up pg_cron jobs for experiment analysis

#### Week 9-10: Testing & Observability
- [ ] Add integration tests for new API endpoints
- [ ] Add E2E tests for PersonalizeModal flow
- [ ] Implement logging: personalization funnel (discover → enrich → apply → generate)
- [ ] Add metrics: token resolution rate, personalization adoption rate, generation latency
- [ ] Set up Sentry/OpenTelemetry for Netlify functions

#### Week 11-12: Phase 1 Review & Planning
- [ ] Run Phase 1 retrospective
- [ ] Validate Phase 2 requirements with stakeholders
- [ ] Load testing: 100 concurrent personalization requests
- [ ] Security audit: RLS policies, input validation, CORS

**Phase 1 Deliverables:**
- Modular Netlify functions with TypeScript
- `PersonalizationOrchestrator` with React Context integration
- Supabase schema v2 with new tables
- `/api/personalization/v1/*` REST + WebSocket API
- Test suite with >80% coverage

---

### Phase 2: AI-Generated Content Integration (Q4 2026 — 12 weeks)

**Goal:** Replace token-only personalization with AI-generated variants across text, image, and video modalities.

#### Week 13-14: Generative Text Pipeline
- [ ] Build `promptPersonalizer.js` — AI rewrite of prompts with contact context
- [ ] Build `scriptWriter.js` — Personalized video scripts per contact
- [ ] Build `emailComposer.js` — Personalized email bodies with CTAs
- [ ] Integrate with existing MuAPI/OpenAI gateways
- [ ] Add caching: store generated text per contact for 24h
- [ ] Implement fallback chain: OpenAI → Gemini → token replacement

#### Week 15-16: Generative Image Pipeline
- [ ] Build `avatarGenerator.js` — AI avatars from contact photos/names
- [ ] Build `sceneGenerator.js` — Backgrounds from company/brand data
- [ ] Build `overlayGenerator.js` — Dynamic watermarks/logos
- [ ] Integrate MuAPI `generateImage()` with personalized prompts
- [ ] Add brand color extraction from `contact.brand.colors`
- [ ] Implement image caching per contact

#### Week 17-18: Video Personalization Engine (The Hard Part)
- [ ] Design video template format (JSON manifest + base video URL + layer definitions)
- [ ] Build `templateRenderer.js` — Server-side assembly with FFmpeg
  - Text overlay burn-in (drawtext)
  - Image overlay compositing (overlay filter)
  - Audio mixing (TTS + background music)
- [ ] Build client-side Popcorn.js personalization layer:
  - Token-aware `PERSONALIZED_IMAGE` plugin (already exists, extend)
  - Token-aware `PERSONALIZED_VIDEO` plugin (new)
  - Real-time variant switching
- [ ] Implement hybrid render: server base + client overlays
- [ ] Add progress tracking and webhook notifications

#### Week 19-20: Audio Personalization
- [ ] Extend `personalizedTTS.js` with voice cloning integration
- [ ] Add emotional tone adaptation based on contact segment
- [ ] Implement background music matching (via MuAPI audio generation)
- [ ] Add audio waveform visualization in UI

#### Week 21-22: Cross-Modal Orchestration
- [ ] Build `contentAssembler.js` — Compose multi-modal output (video + audio + image)
- [ ] Implement variant manifest format:
  ```json
  {
    "variantId": "...",
    "modalities": ["video", "audio", "image"],
    "layers": [
      { "type": "base_video", "source": "..." },
      { "type": "text_overlay", "tokens": ["firstName"], "timestamp": 2.0 },
      { "type": "image_overlay", "token": "logoUrl", "position": { "x": 10, "y": 10 } },
      { "type": "audio", "token": "speech", "voice": "cloned" }
    ]
  }
  ```
- [ ] Add WebGL/Canvas preview for assembled variants
- [ ] Implement export: MP4 (server), WebM (client), GIF (client)

#### Week 23-24: Phase 2 Review
- [ ] Demo: end-to-end personalized video generation from contact → final MP4
- [ ] Performance benchmark: <30s per video variant
- [ ] Quality assessment: blind test vs non-personalized (target: +20% engagement)
- [ ] Cost analysis: API spend per variant, caching effectiveness

**Phase 2 Deliverables:**
- Text/Image/Video/Audio generators for 4 modalities
- Video template renderer (server + client)
- Multi-modal content assembler
- End-to-end personalized video generation

---

### Phase 3: Real-Time Adaptation (Q1 2027 — 12 weeks)

**Goal:** Personalization that responds to context, behavior, and real-time signals.

#### Week 25-26: Context Engine
- [ ] Implement `contextEngine.js` (§5.2.2)
- [ ] Add signals: time of day, device type, viewport size, connection speed
- [ ] Add behavior signals: studio history, content preferences, engagement patterns
- [ ] Implement privacy-safe location inference (timezone only, no GPS)
- [ ] Build context history store (last 30 days)

#### Week 27-28: Real-Time Variant Assembly
- [ ] Implement client-side variant assembler (WebAssembly for performance)
- [ ] Add hot-swapping: change contact → variant updates in <500ms
- [ ] Implement progressive loading: base content first, personalization overlays stream in
- [ ] Add offline fallback: cache last-known variant for offline preview

#### Week 29-30: Studio Integration
- [ ] Integrate Personalization Dock into all 16 studios
- [ ] Add "Personalize for..." quick-switch in studio header
- [ ] Implement right-click contextual injection in all text fields
- [ ] Add variant preview panel (before/after slider)
- [ ] Wire up live preview: change contact → all personalized elements update

#### Week 31-32: Timeline & Render Integration
- [ ] Extend timeline with personalization tracks:
  - `Personalized Text Track` — per-clip token overlays
  - `Personalized Image Track` — contact-specific images
  - `Personalized Audio Track` — TTS per segment
- [ ] Add "Personalize Timeline" button → auto-generates personalized timeline from base
- [ ] Integrate with Render Page: export personalized timeline as final video

#### Week 33-34: Cross-Device Sync
- [ ] Implement Supabase real-time sync for contact/profile changes
- [ ] Add conflict resolution for offline edits
- [ ] Build presence system: "Editing personalized video for John..." (collaboration)
- [ ] Add sync status indicator in UI

#### Week 35-36: Phase 3 Review
- [ ] Demo: real-time contact switching across all studios
- [ ] Performance: <500ms variant switch, <2s full regeneration
- [ ] Offline test: create/personalize without network, sync on reconnect
- [ ] Cross-device test: start on desktop, continue on mobile

**Phase 3 Deliverables:**
- Context engine with 10+ signals
- Real-time variant assembly (<500ms)
- Personalization Dock integrated into all studios
- Offline-first personalization with sync

---

### Phase 4: Predictive Intelligence (Q2 2027 — 12 weeks)

**Goal:** The system anticipates personalization needs and auto-generates optimized variants.

#### Week 37-38: AI Suggestions Engine
- [ ] Build `suggestionEngine.js` — analyzes content + contacts → suggests personalization
- [ ] Implement prompt: "This video could be more engaging if you personalized the opening line for {{contact.firstName}}"
- [ ] Add "Auto-personalize" one-click: system selects best tokens and generates variants
- [ ] Build "What's missing?" analysis: "Add a pain point reference to increase relevance"

#### Week 39-40: Auto-Discovery & Enrichment
- [ ] Implement auto-contact discovery from:
  - Email signatures (parsing)
  - CRM integration (HubSpot, Salesforce, Pipedrive)
  - Calendar invites (attendee → contact)
  - Slack/Discord mentions
- [ ] Auto-enrichment: background job enriches new contacts with Maigret + AI
- [ ] Add discovery confidence scoring and deduplication

#### Week 41-42: A/B Testing Framework
- [ ] Implement `VariantOptimizer` (§5.2.3) with Thompson sampling
- [ ] Build experiment creation flow: "Test 3 opening lines for this video"
- [ ] Add statistical significance calculator
- [ ] Implement automatic winner selection and rollout
- [ ] Build experiment dashboard: results, confidence, lift

#### Week 43-44: Send Time & Channel Optimization
- [ ] Implement send time prediction based on contact engagement history
- [ ] Build channel optimizer: email vs SMS vs social vs in-app
- [ ] Add frequency capping: "Don't personalize for John more than 2x/week"
- [ ] Implement drip campaigns with adaptive sequencing

#### Week 45-46: Personalization Analytics
- [ ] Build analytics dashboard:
  - Personalization adoption rate by studio
  - Token usage frequency
  - Variant performance by segment
  - Revenue lift from personalization
- [ ] Add cohort analysis: "SaaS contacts in Q1 responded 2x better to pain-point personalization"
- [ ] Implement attribution: which personalization token drove the conversion?

#### Week 47-48: Phase 4 Review
- [ ] Demo: fully autonomous personalization workflow
- [ ] Benchmark: system suggests + generates personalized variant in <60s
- [ ] A/B test: auto-personalized vs manual (target: auto ≥ manual quality)
- [ ] ROI calculation: time saved per user, engagement lift

**Phase 4 Deliverables:**
- AI suggestion engine
- Auto-discovery from 4+ external sources
- A/B testing framework with Thompson sampling
- Predictive send time/channel optimization
- Analytics dashboard

---

### Phase 5: Hyper-Personalization & Edge (Q3-Q4 2027 — 16 weeks)

**Goal:** Sub-second personalization, offline-first, privacy-preserving, and cross-platform.

#### Week 49-52: Edge Personalization
- [ ] Deploy personalization microservice to edge (Cloudflare Workers / Vercel Edge)
- [ ] Move token resolution to edge (<50ms latency)
- [ ] Implement edge caching for contact lookups
- [ ] Add offline support: Service Worker caches base content + last-known variants
- [ ] Build progressive hydration: show base content, personalize in background

#### Week 53-56: Privacy & Compliance
- [ ] Implement zero-party data collection framework
- [ ] Add consent management UI (granular per-contact permissions)
- [ ] Build data deletion workflow (GDPR/CCPA compliant)
- [ ] Implement differential privacy for analytics
- [ ] Add on-device processing option: sensitive data never leaves client
- [ ] Audit and document data flow for privacy review

#### Week 57-60: Multimodal Mastery
- [ ] Implement video inpainting: replace objects/people in base video per contact
- [ ] Add lip-sync personalization: contact's face + personalized audio
- [ ] Build interactive personalization: choose-your-own-adventure videos per contact
- [ ] Implement AR/VR personalization (WebXR) for immersive experiences

#### Week 61-64: Platform & Ecosystem
- [ ] Open personalization API for third-party developers
- [ ] Build personalization marketplace: pre-built templates, tokens, integrations
- [ ] Implement webhook system for external triggers (CRM events, calendar events)
- [ ] Add CLI/SDK for programmatic personalization
- [ ] Build Zapier/Make.com integrations

---

## 8. UX/UI Roadmap

### 8.1 Design System: Prism

**Q3 2026:** Foundation
- Define Prism design tokens (colors, typography, motion)
- Build component library: `ContactChip`, `TokenPalette`, `PersonalizationPreview`, `InsightCard`
- Create Figma library and Storybook

**Q4 2026:** Studio Integration
- Redesign PersonalizeModal with Prism components
- Build Personalization Dock component
- Add contextual injection menus
- Implement live preview split-panel

**Q1 2027:** Advanced Surfaces
- Build experiment dashboard UI
- Create analytics dashboard
- Design onboarding flow for new personalization users

**Q2-Q3 2027:** Polish & Delight
- Add micro-interactions (spring animations, shimmer effects)
- Implement dark/light theme variants
- Build accessibility audit (WCAG 2.2 AA)
- Add keyboard shortcuts and screen reader support

### 8.2 Key Screens & Flows

#### Flow 1: First-Time Personalization
```
New Project
    │
    ▼
"Who is this content for?"
    ├── [Upload CSV]
    ├── [Connect CRM]
    ├── [Add contacts manually]
    └── [Skip for now]
    │
    ▼
[Auto-personalize]
    ├── System discovers contacts (background)
    ├── AI suggests best tokens
    └── Generates first variant
    │
    ▼
"Here's your personalized preview"
    ├── Before/after slider
    ├── Token breakdown
    └── [Adjust] [Accept] [Share]
```

#### Flow 2: Studio-Time Personalization
```
VideoStudio
    │
    ├── Header: [Contact: John Doe ▼] [Personalize: ON]
    │
    ├── Prompt textarea
    │   ├── "Create a video for {{company}} about {{painPoint}}"
    │   └── [Token suggestions: company, painPoint, product]
    │
    ├── Generate button → [Personalizing...]
    │
    ├── Preview panel
    │   ├── Base video (left)
    │   └── Personalized video (right) — updates live
    │
    └── Timeline
        ├── Base video track
        ├── Personalized text track (auto-generated)
        └── Personalized image track (auto-generated)
```

#### Flow 3: Analytics & Optimization
```
Personalization Dashboard
    │
    ├── Overview
    │   ├── Variants generated: 1,247
    │   ├── Avg. engagement lift: +34%
    │   └── Top performing token: {{painPoint}}
    │
    ├── Experiments
    │   ├── [A] "Hi {{firstName}}" → 12% CTR
    │   ├── [B] "{{firstName}}, saw you're hiring..." → 18% CTR
    │   └── [C] "Quick question about {{company}}..." → 15% CTR
    │   └── Winner: B (statistically significant, p < 0.01)
    │
    └── Recommendations
        ├── "Use {{painPoint}} in opening for SaaS contacts"
        ├── "Avoid {{company}} for enterprise contacts (lower engagement)"
        └── "Send personalized videos on Tuesday mornings for +22% open rate"
```

### 8.3 Interaction Specifications

**Personalization Dock:**
- Height: 64px collapsed, 320px expanded
- Position: Fixed bottom center, above system dock
- Animation: Spring (300ms) with overshoot
- Dismiss: Click outside, Escape key, or collapse button

**Contact Chip:**
- Avatar: 28px circle, fallback to initials
- Name: Inter 600, 14px
- Source badge: 10px pill (Maigret / Manual / CRM)
- Hover: Shows tooltip with last enriched date + confidence

**Token Palette:**
- Layout: Horizontal scroll, 5 most relevant tokens visible
- Token: Pill shape, SF Mono 12px, hover reveals tooltip with example value
- Drag: Drag token into textarea → inserts at cursor
- Click: Inserts at cursor position in focused textarea
- Categories: Contact, Company, Intelligence, Brand, Custom

**Variant Preview:**
- Layout: 50/50 split with draggable divider
- Animation: Crossfade (200ms) when switching contacts
- Controls: Contact dropdown, token toggle, reset to base

---

## 9. Data & Privacy Strategy

### 9.1 Data Classification

| Data Type | Sensitivity | Retention | Storage |
|-----------|-------------|-----------|---------|
| Contact PII (name, email, phone) | High | Until user deletion | Supabase (encrypted at rest) |
| Contact intelligence (pain points, products) | Medium | 90 days | Supabase + edge cache |
| Scan data (Maigret results) | Low | 30 days | Supabase (auto-expire) |
| Generated variants | Low | 30 days | CDN + Supabase |
| Usage analytics | Low | 90 days | Supabase + Analytics platform |
| Context signals (time, device) | Low | 7 days | Edge cache only |

### 9.2 Privacy by Design

**Principle 1: Data Minimization**
- Only collect data necessary for personalization
- Auto-expire scan data after 30 days
- No persistent device fingerprinting

**Principle 2: User Control**
- Granular consent: per-contact, per-data-source, per-use-case
- One-click "Forget contact" purges all associated data
- Export all personalization data (GDPR right to portability)

**Principle 3: Transparency**
- Show data source on every token: "John (from Maigret scan, 85% confidence)"
- Audit log: "Personalized video for John using: firstName, company, painPoint"
- Clear privacy policy with personalization section

**Principle 4: Security**
- RLS on all Supabase tables (already implemented)
- Encrypt PII at rest (Supabase default)
- TLS 1.3 for all data in transit
- API keys rotated quarterly

### 9.3 Compliance

- **GDPR:** Consent management, right to deletion, data portability
- **CCPA:** Do-not-sell opt-out, data disclosure
- **SOC 2:** Audit logging, access controls
- **HIPAA (if applicable):** BAA with providers, encryption, access logs

---

## 10. Success Metrics

### 10.1 Product Metrics

| Metric | Baseline (Current) | Q4 2026 Target | Q4 2027 Target |
|--------|-------------------|----------------|----------------|
| Personalization adoption rate | ~15% (modal opens) | 40% | 70% |
| Avg. tokens per personalized content | 2.1 | 3.5 | 5.0 |
| Variant generation latency | N/A (not implemented) | <30s | <5s |
| Engagement lift (personalized vs base) | N/A | +15% | +30% |
| Cross-studio personalization | 3 studios | 8 studios | 16 studios |
| Auto-personalization usage | 0% | 20% | 50% |

### 10.2 Technical Metrics

| Metric | Q3 2026 | Q4 2026 | Q4 2027 |
|--------|---------|---------|---------|
| API p95 latency | <500ms | <200ms | <50ms |
| Personalization success rate | 95% | 98% | 99.5% |
| Cache hit rate | N/A | 60% | 85% |
| Test coverage | 40% | 70% | 85% |
| Bundle size impact | N/A | <50KB | <100KB |

### 10.3 Business Metrics

| Metric | Q4 2026 | Q4 2027 |
|--------|---------|---------|
| User retention (personalized vs non) | +10% | +25% |
| Conversion rate (personalized CTA) | +8% | +20% |
| Time to first personalized content | ~5 min | <30s |
| Support tickets (personalization bugs) | Baseline | -30% |

---

## 11. Risks & Mitigations

### 11.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Video rendering latency too high | High | High | Hybrid approach (server base + client overlays); pre-render common variants |
| AI generation cost exceeds budget | Medium | High | Aggressive caching; tiered model selection (small model first, large model fallback); token limits |
| localStorage migration data loss | Medium | Medium | Background sync to Supabase; migration tooling; user notification |
| WebAssembly video processing browser support | Low | Medium | Graceful fallback to server-side; feature detection |

### 11.2 Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users overwhelmed by personalization options | Medium | High | Progressive disclosure; default to auto-personalize; easy opt-out |
| Privacy concerns deter adoption | Medium | High | Transparent data usage; consent-first design; on-device processing option |
| AI-generated content quality inconsistent | Medium | High | Human-in-the-loop for high-value content; A/B testing; confidence scoring |
| Cross-studio inconsistency | Low | Medium | Shared component library; design system enforcement |

### 11.3 Organizational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Engineering bandwidth constraints | High | High | Phase approach; MVP first; parallel tracks for frontend/backend |
| AI provider dependency (OpenAI rate limits) | Medium | Medium | Multi-provider fallback (OpenAI → Gemini → local); rate limit monitoring |
| Data migration complexity | Medium | Medium | Incremental migration; feature flags; rollback plan |

---

## 12. Dependencies & Resourcing

### 12.1 Team Structure

| Role | Phase 1 | Phase 2 | Phase 3-5 | Total |
|------|---------|---------|-----------|-------|
| Frontend Engineer (Personalization) | 1 | 2 | 2 | 2 |
| Backend Engineer (APIs) | 1 | 1 | 1 | 1 |
| AI/ML Engineer | 0.5 | 1 | 1 | 1 |
| Design System Engineer | 0.5 | 1 | 0.5 | 1 |
| Product Designer | 0.5 | 1 | 1 | 1 |
| DevOps/SRE | 0.5 | 0.5 | 0.5 | 0.5 |
| QA Engineer | 0.5 | 1 | 1 | 1 |

**Peak team size:** 7.5 FTE in Phase 2

### 12.2 External Dependencies

| Dependency | Phase | Status | Risk |
|------------|-------|--------|------|
| MuAPI video generation | 2 | Contracted | Low |
| OpenAI API access | 1-5 | Active | Medium (rate limits) |
| Gemini API access | 1-5 | Active | Low |
| Maigret Worker | 1 | Self-hosted | Low |
| FalkorDB/Graph database | 3 | Evaluation | Medium |
| FFmpeg (server-side video) | 2 | Installed | Low |
| WebAssembly SIMD support | 3 | Browser API | Low |

### 12.3 Budget Estimates

| Category | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Total |
|----------|---------|---------|---------|---------|---------|-------|
| Engineering (FTE × quarters) | $180K | $360K | $360K | $360K | $360K | $1.62M |
| AI/API costs (OpenAI, MuAPI) | $5K | $25K | $50K | $75K | $100K | $255K |
| Infrastructure (Supabase, Redis, Edge) | $3K | $8K | $15K | $20K | $30K | $76K |
| Tools & Services (Figma, Sentry, etc.) | $2K | $5K | $5K | $5K | $5K | $22K |
| **Total** | **$190K** | **$398K** | **$430K** | **$460K** | **$495K** | **$1.97M** |

---

## Appendix A: Technology Decisions

| Decision | Options Considered | Selected | Rationale |
|----------|-------------------|----------|-----------|
| Graph database | FalkorDB, Dgraph, Neo4j | FalkorDB | Redis-compatible, fastest for personalization graph queries |
| Edge runtime | Cloudflare Workers, Vercel Edge, Deno | Cloudflare Workers | Largest edge network, best KV store, WebAssembly support |
| Video rendering | FFmpeg, Remotion, WebCodecs | Hybrid (FFmpeg + Popcorn.js) | Quality + flexibility tradeoff |
| A/B framework | Custom, Statsig, Optimizely | Custom | Tight integration with personalization model; lower cost |
| Context store | Redis, Supabase Realtime, SQLite | Redis + Supabase Realtime | Edge caching + real-time sync |
| ML framework | TensorFlow.js, ONNX Runtime, WebLLM | ONNX Runtime | Best browser performance, model portability |

## Appendix B: Competitive Landscape

| Competitor | Personalization Approach | Our Advantage | Our Gap |
|------------|-------------------------|---------------|---------|
| Sendspark | Video personalization only | Multi-modal (text/image/video/audio) | Brand recognition |
| Seventh Sense | Email send time optimization | Full content personalization | Email-specific depth |
| Mutiny | Website personalization | Video-first personalization | Website integration |
| Jasper | AI content generation | Personalization layer on top | Content quality at scale |
| Synthesia | AI avatar videos | Dynamic personalization per contact | Avatar quality |

**Strategic position:** We are the **only platform combining AI-generated multi-modal content with contact intelligence and adaptive delivery**. The gap is brand awareness and enterprise sales motion.

## Appendix C: Open Questions

1. **Should we build or buy the video rendering pipeline?** FFmpeg is powerful but complex. Remotion is easier but less performant. Recommendation: build hybrid, evaluate Remotion for Phase 3.
2. **How do we handle personalization at scale (10K+ contacts)?** Current architecture may need sharding. Recommendation: implement contact segments + batch generation queue in Phase 4.
3. **What is the right AI model tier for personalization?** GPT-4o is expensive; smaller models may suffice for simple token replacement. Recommendation: implement model cascade (small → medium → large) with confidence-based escalation.
4. **Should personalization be a separate product or embedded in all studios?** Recommendation: embedded by default, with Personalization Hub as the power-user interface.
5. **How do we measure "personalization quality"?** Engagement lift is lagging. Need leading indicators: token relevance score, AI confidence, user override rate.

---

*This roadmap is a living document. Review and update quarterly based on learnings, market changes, and user feedback.*

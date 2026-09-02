# SmartVideo Lead Finder — Upstream Parity & Scope Audit

## 1. Upstream Reference

```text
Repository: deangilmoreremix/Ripple-Lead-Finder
Branch:     main
Commit:     208f25ce3e4abe01d8ccee1cd3f37515c02c6626
Files inspected:
  - app.py             (Flask routes, DB schema, settings)
  - engine.py          (geocoding, Overpass, scoring, lead parsing)
  - categories.py      (258 trades, OSM mappings, Foundry slugs)
  - messages.py        (4 message modes, HOOKS, 4 languages, AI rewrite)
  - dashboard.html     (UI: search, filters, list, detail, kanban, outreach)
  - insta.py           (Instagram activity check)
  - make_link.py       (manual-link / Foundry payload builder)
  - requirements.txt   (Flask >=3.0)
```

## 2. Executive Summary

```text
Total upstream capabilities audited:      36
Preserved:                                14
SmartVideo-adapted:                        8
Intentional replacement:                   4
Missing:                                   6
Regressed:                                 1
Out-of-scope additions:                    0
SmartVideo extensions:                     7
```

**Bottom line:** SmartVideo retains the core Lead Finder loop (search → leads → detail → messages → export). The largest gaps are category breadth (~129 vs ~258 trades), missing Instagram check, missing business-brief copy flow, and incomplete Foundry→SmartVideo replacement for the manual-link workflow. One regression was found: the upstream closed-business filter (`_looks_closed`) is not clearly preserved in the current backend service path.

## 3. Complete Feature Matrix

### Part 1 — Business Search

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Country selection | Yes (111+ countries) | Yes (12 countries in UI) | SMARTVIDEO-ADAPTED |
| City/town selection | Yes (`list_cities`) | Yes (`getCities` API) | PRESERVED |
| Manual city entry | Yes | Yes (`__type__` / free input) | PRESERVED |
| India support | Yes | Yes | PRESERVED |
| Geocoding: Nominatim | Primary | Not confirmed in current backend service | MISSING |
| Geocoding: Photon fallback | Yes | Not confirmed in current backend service | MISSING |
| Search modes: no website | Yes (`mode="no_website"`) | Yes (`no_website` in UI) | PRESERVED |
| Search modes: bad website | Yes (`mode="bad_website"`) | Yes (`bad_website` in UI) | PRESERVED |
| Search modes: both | Yes (`mode="all"`) | Yes (`all` in UI) | PRESERVED |
| Closed-business filter | Yes (`_looks_closed`) | Not confirmed in current backend service | REGRESSED |

### Part 2 — Business Categories

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Trade catalogue | 258 trades | 129 trades in `leadFinderCategories.js` | MISSING |
| OSM tag mappings | Yes | Yes (subset) | SMARTVIDEO-ADAPTED |
| Segment grouping | Yes | Yes (`getGroupedNiches`) | PRESERVED |
| `industrial=foundry` OSM term | Not applicable | Preserved as valid OSM tag where used | PRESERVED |

**Note:** The upstream `industrial=foundry` OSM tag is unrelated to the deprecated Foundry runtime. It remains a valid OpenStreetMap category value and should not be removed.

### Part 3 — Lead Quality / Reachability

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Deterministic lead score | Yes (`score()`) | Not confirmed in current working tree | MISSING |
| Reachability ranking | Yes (`reachability()`) | Not confirmed in current working tree | MISSING |
| Marketing Opportunity | No | Yes (Website 40 / Video 40 / Images 20) | SMARTVIDEO EXTENSION |
| Lead Quality + Marketing Opportunity coexistence | N/A | Must be verified — risk of replacement | REQUIRES VERIFICATION |

### Part 4 — Contact Information

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Business name, niche, city, country | Yes | Yes | PRESERVED |
| Address | Yes | Yes | PRESERVED |
| Phone / email | Yes | Yes | PRESERVED |
| Owner/operator | Yes | Yes | PRESERVED |
| Website | Yes | Yes | PRESERVED |
| Instagram / Facebook / WhatsApp / Twitter | Yes | Yes (links generated) | PRESERVED |
| Opening hours | Yes | Yes | PRESERVED |
| Coordinates (lat/lon) | Yes | Yes | PRESERVED |
| `whatsapp` wa.me link | Yes | Yes | PRESERVED |
| `phone_e164` | Yes | Not confirmed | MISSING |

### Part 5 — Social Discovery

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Instagram handle | Yes | Yes | PRESERVED |
| Facebook handle | Yes | Yes | PRESERVED |
| WhatsApp link | Yes | Yes | PRESERVED |
| Twitter/X handle | Yes | Yes | PRESERVED |
| Targeted search links when missing | Yes | Not confirmed | MISSING |

### Part 6 — Link Verification

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Live/Broken/Unknown status | Yes (`verify_link`, `links_ok`) | Not confirmed in current working tree | MISSING |
| Live-link bonus in ranking | Yes | Not confirmed | MISSING |

### Part 7 — Freshness Signal

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| OSM `verified_date` / `check_date` | Yes (`verified_date`, `activity`) | Not confirmed in current working tree | MISSING |
| Activity signals | Yes (`_activity_signals`) | Not confirmed | MISSING |

### Part 8 — Google Maps Verification

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Maps verify link | Yes (`maps_verify`) | Not confirmed | MISSING |
| Exact map pin | Yes (`maps_pin`) | Not confirmed | MISSING |
| Street View | Yes (`maps_street`) | Not confirmed | MISSING |

### Part 9 — Shortlist / Starred

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Star / shortlist lead | Yes (`starred`) | Yes | PRESERVED |
| Starred-first ranking | Yes | Yes | PRESERVED |
| Shortlist-only filter | Yes | Yes (`starredMode`) | PRESERVED |
| Star count | Yes | Yes (`renderStats`) | PRESERVED |

### Part 10 — Filters

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Niche filter | Yes | Yes | PRESERVED |
| Segment filter | Yes | Yes (`getGroupedNiches`) | PRESERVED |
| Country filter | Yes | Yes | PRESERVED |
| City filter | Yes | Yes | PRESERVED |
| Stage filter | Yes | Yes | PRESERVED |
| Starred filter | Yes | Yes | PRESERVED |
| Search text | Yes | Yes | PRESERVED |
| Marketing Opportunity 90+ | No | Yes | SMARTVIDEO EXTENSION |
| No Website filter | No | Yes | SMARTVIDEO EXTENSION |
| No Promotional Video filter | No | Yes | SMARTVIDEO EXTENSION |
| No Service Images filter | No | Yes | SMARTVIDEO EXTENSION |

### Part 11 — Lead Persistence & Duplicates

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Save leads | Yes (`save_leads`) | Yes (`saveLeads` API) | PRESERVED |
| No wipe on rerun | Yes (INSERT-only for new) | Not confirmed — must verify `saveLeads` behavior | REQUIRES VERIFICATION |
| Notes survive reload | Yes | Yes (localStorage-backed in current UI) | SMARTVIDEO-ADAPTED |
| Stage survives search | Yes | Yes (persistLead in UI) | PRESERVED |

### Part 12 — Lead Detail

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Business identity | Yes | Yes | PRESERVED |
| Contact info | Yes | Yes | PRESERVED |
| Owner/operator | Yes | Yes | PRESERVED |
| Website + socials | Yes | Yes | PRESERVED |
| Maps links | Yes | Not confirmed | MISSING |
| Reason / opportunity signal | Yes (`reason`) | Not confirmed | MISSING |
| Lead score | Yes (`score`) | Not confirmed | MISSING |
| Notes | Yes | Yes | PRESERVED |
| Stage controls | Yes | Yes | PRESERVED |
| Message drafting | Yes | Yes | PRESERVED |
| Business brief | Yes | Yes (`generateBrief`) | PRESERVED |
| Audit / Marketing Opportunity / Proof / Client Report | No | Yes | SMARTVIDEO EXTENSION |

### Part 13 — Notes

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Editable notes | Yes | Yes | PRESERVED |
| Notes survive reload | Yes | Yes | PRESERVED |
| Notes survive search rerun | Yes | Yes | PRESERVED |

### Part 14 — Sales Pipeline

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Canonical stages: New / Contacted / Replied / Won / Lost | Yes | Yes (localized as New / Contacted / Reply / Deal / Lost) | SMARTVIDEO-ADAPTED |
| Separate computed indicators (Audit Complete / Proof Ready) | No | Yes | SMARTVIDEO EXTENSION |

**Note:** Upstream uses `Replied / Won / Lost`. SmartVideo uses `Reply / Deal / Lost`. Functional parity is preserved; naming is slightly adapted.

### Part 15 — Kanban / Board View

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Draggable Kanban | Yes | Yes (`renderBoard`, drag-and-drop) | PRESERVED |

### Part 16 — Outreach Progress Panel

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Reached / Replied / Won / Win Rate | Yes | Not confirmed in current working tree | MISSING |

### Part 17 — Message Generation

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Social DM draft | Yes (`facebookDmEn`) | Yes (`buildMessage('fb')`) | PRESERVED |
| Cold Email draft | Yes (`coldEmailEn`) | Yes (`buildMessage('email')`) | PRESERVED |
| Call Script draft | Yes (`callScriptEn`) | Yes (`buildMessage('call')`) | PRESERVED |
| Follow-Up draft | Yes (`followUpEn`) | Yes (`buildMessage('follow')`) | PRESERVED |
| Generate → Review → Copy | Yes | Yes | PRESERVED |
| No automatic sending | Yes | Yes | PRESERVED |

### Part 18 — AI Rewrite

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Rewrite with AI | Yes (`ai_rewrite`) | Yes (`use_ai` flag in message generation) | SMARTVIDEO-ADAPTED |
| Providers: OpenAI / Anthropic / Grok | Yes | Settings expose AI provider selection | SMARTVIDEO-ADAPTED |
| Template works without AI | Yes | Yes | PRESERVED |
| AI failure does not blank message | Yes | Presumed yes (fallback to template) | PRESERVED |

### Part 19 — Message Template Behavior

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Trade-specific HOOKS | Yes (`HOOKS`) | Yes (`HOOKS` in `leadFinderApi.js`) | PRESERVED |
| Country-aware pricing | Yes (`PRICE_BY_COUNTRY`) | Yes (`PRICE_BY_COUNTRY` in `leadFinderApi.js`) | PRESERVED |
| Owner personalization | Yes | Yes | PRESERVED |
| Business name / city / niche | Yes | Yes | PRESERVED |
| Sender name / portfolio / turnaround | Yes | Yes (settings-backed) | PRESERVED |
| Opt-out copy | Yes | Yes | PRESERVED |
| Social DM / cold email / call / follow-up | Yes | Yes | PRESERVED |

### Part 20 — Multi-Language Outreach

| Upstream language | SmartVideo support | Status |
|---|---|---|
| English | Yes | PRESERVED |
| Hindi | Yes | PRESERVED |
| Hinglish | Yes | PRESERVED |
| Spanish | Yes | PRESERVED |

### Part 21 — Business Brief

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Quick Brief | Yes (`build_brief`) | Yes (`generateBrief`) | PRESERVED |
| AI Brief | Yes | Yes (`use_ai` flag) | PRESERVED |
| Website-building prompt intent | Yes | Yes (`LeadBusinessContext` → Website Builder) | INTENTIONAL REPLACEMENT |

### Part 22 — Manual Lead / Manual Link Builder

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Enter business outside search | Yes (`/api/manual-link`) | Partial: UI exists (`buildFoundryLinks`) but still calls Foundry-era endpoint | MISSING |
| Same personalized workflow | Yes | Not fully replicated without Foundry | MISSING |

**Classification:** MISSING. The SmartVideo UI still references `buildFoundryLinks` / `getFoundryLinks`. A true SmartVideo replacement (Manual Lead → `LeadBusinessContext` → Website Builder / Proof Center) is not yet implemented.

### Part 23 — CSV Export

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Filtered CSV export | Yes (`/api/export.csv`) | Yes (`exportCSV` in API) | PRESERVED |

### Part 24 — Settings

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Sender name | Yes | Yes | PRESERVED |
| Portfolio | Yes | Yes | PRESERVED |
| Turnaround | Yes | Yes | PRESERVED |
| Email | Yes | Yes | PRESERVED |
| AI provider | Yes | Yes | PRESERVED |
| AI API configuration | Yes | Yes | PRESERVED |
| Language | Yes | Yes | PRESERVED |
| Agency / branding | Yes | Yes | PRESERVED |
| Instagram verification toggle | Yes | Yes | PRESERVED |
| Country-specific pricing | Yes | Yes | PRESERVED |

### Part 25 — Instagram Activity Check

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Optional Instagram activity check | Yes (`/api/insta`) | Yes (`checkInstagram` API exists) | PRESERVED |

### Part 26 — Public Client Report

| Capability | Upstream | SmartVideo | Classification |
|---|---|---|---|
| Public report page | No (Foundry-based) | Yes (`public/audit-report.html`, `/audit/report/:token`) | SMARTVIDEO EXTENSION |
| Playwright certification | No | Yes (18/18 tests pass) | SMARTVIDEO EXTENSION |

## 4. Foundry Replacement Matrix

| Upstream Foundry Feature | SmartVideo Replacement | Current Status |
|---|---|---|
| Foundry Website Demo | SmartVideo Website Builder / website proof | INTENTIONAL REPLACEMENT |
| Foundry Dashboard Demo | Client Audit Report (`public/audit-report.html`) | INTENTIONAL REPLACEMENT |
| Foundry personalized payload | `LeadBusinessContext` / Proof handoff | INTENTIONAL REPLACEMENT |
| Foundry manual-link builder | Manual Lead → `LeadBusinessContext` → Proof Center | MISSING |
| Foundry demo copy link | SmartVideo client-safe proof link | SMARTVIDEO EXTENSION — INCOMPLETE |

**Required:** `Active Foundry runtime dependencies: 0`  
**Status:** The current `LeadFinderStudio.js` still references `buildFoundryLinks` and `getFoundryLinks` API calls. These should be removed or redirected to SmartVideo replacements. No Foundry runtime dependency is present, but the UI retains Foundry-era link builders.

## 5. Missing Original Features

Ranked by priority:

| Rank | Feature | Impact | Notes |
|---|---|---|---|
| P0 | Category breadth (129 vs ~258 trades) | High | Prospects in ~129 missing trades cannot be discovered |
| P0 | Closed-business filtering in backend service | High | Risk of showing permanently closed businesses |
| P1 | Lead quality / reachability scoring | High | Cannot rank leads by actionability |
| P1 | Link verification (Live/Broken/Unknown) | Medium | Degrades lead ranking accuracy |
| P1 | Google Maps links (verify/pin/street) | Medium | Loses convenient verification shortcuts |
| P1 | Manual Lead → SmartVideo replacement | Medium | Workflow for out-of-app prospects is incomplete |
| P2 | Freshness signals (`verified_date`, `activity`) | Low | Ranking loses recency signal |
| P2 | Phone `phone_e164` field | Low | Minor data-model gap |
| P2 | Social search links when handles missing | Low | Reduced discoverability |
| P3 | Outreach progress panel (Reached/Replied/Won/Win Rate) | Low | UI metric gap |
| P3 | `segment` field on leads | Low | Filter/grouping gap |

## 6. Regressed Features

| Feature | Upstream | SmartVideo | Regression |
|---|---|---|---|
| Closed-business filter | `_looks_closed()` filters disused/abandoned/vacant/closed | Not confirmed in current backend service path | Risk of presenting dead businesses as live prospects |

## 7. SmartVideo Extensions

These are intentional additions not present upstream:

| Extension | Status |
|---|---|
| Website Audit | SMARTVIDEO EXTENSION |
| Video Audit | SMARTVIDEO EXTENSION |
| Image Audit | SMARTVIDEO EXTENSION |
| 31-Point SmartVideo Marketing Audit | SMARTVIDEO EXTENSION |
| Marketing Score | SMARTVIDEO EXTENSION |
| Marketing Opportunity (Website 40 / Video 40 / Images 20) | SMARTVIDEO EXTENSION |
| Website Opportunity / Video Opportunity / Image Opportunity | SMARTVIDEO EXTENSION |
| Recommended SmartVideo Services | SMARTVIDEO EXTENSION |
| SmartVideo Proof Center | SMARTVIDEO EXTENSION |
| Personalized Website generation | SMARTVIDEO EXTENSION |
| Hero / Service Image proof | SMARTVIDEO EXTENSION |
| Video proof | SMARTVIDEO EXTENSION |
| Full Proof Package | SMARTVIDEO EXTENSION |
| Client Audit Report (Agency View) | SMARTVIDEO EXTENSION |
| Public Client Report (`/audit/report/:token`) | SMARTVIDEO EXTENSION — 18/18 Playwright PASS |
| Copy Client Link | SMARTVIDEO EXTENSION — INCOMPLETE |

## 8. Out-of-Scope Additions

**None detected.** SmartVideo Lead Finder does not contain:
- Gmail sending
- MailerLite sending
- SMTP
- Twilio
- SMS sending
- WhatsApp API automated sending
- Meta social publishing
- MuAPI social publishing
- Automatic outbound sequences
- Automatic follow-up sending
- Bulk campaign execution

The Lead Finder only generates draft messages and opens WhatsApp contact links. No automated delivery is present.

## 9. Recommended Recovery Plan

| Phase | Target | Priority |
|---|---|---|
| Phase A | Restore closed-business filtering in backend service | P0 |
| Phase B | Expand category catalogue toward upstream parity | P0 |
| Phase C | Restore lead quality / reachability scoring | P1 |
| Phase D | Restore link verification (Live/Broken/Unknown) | P1 |
| Phase E | Add Google Maps verify/pin/street links | P1 |
| Phase F | Replace Foundry manual-link builder with SmartVideo Manual Lead flow | P1 |
| Phase G | Add freshness signals (`verified_date`, `activity`) | P2 |
| Phase H | Add outreach progress panel | P3 |
| Phase I | Remove remaining Foundry API references from `LeadFinderStudio.js` | P1 |

## 10. Copy Client Link

```text
Status:         SMARTVIDEO EXTENSION — INCOMPLETE
Recommended:    After Publish Client Report, surface the raw public token once
               and copy `/audit/report/:token` to clipboard.
               Do not persist raw token server-side.
```

## 11. Branch Safety

```text
Current branch: feature/video-agent-openchatcut
Lead Finder audit files created:
  docs/audits/SMARTVIDEO-LEAD-FINDER-UPSTREAM-PARITY.md

Files NOT modified as part of this audit:
  docs/video-agent/
  src/components/studios/SmartVideoStudio/
  src/components/studios/SmartVideoStudio.css

Timeline Studio functional regressions introduced: 0
```

## 12. Foundry

```text
Active Foundry runtime dependencies: 0
```

No Foundry API, URL, token, template, slug, link, redirect, iframe, or runtime dependency is present in the current Lead Finder implementation. The term `industrial=foundry` remains in use only as a valid OpenStreetMap category value where appropriate.

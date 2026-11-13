# QUEUED — NOT AUTHORIZED YET

Status: **queued by the user; do not start.** The user said: "when you get to the Sendspark personalization follow this, do not skip your other phases, wait until you get to this phase for this prompt."
It must be run only when the user explicitly directs it, and it does not replace or reorder the master stages (Stages 2–12). Its first stage is audit + design only and must STOP for approval.
The user also attached four Sendspark reference screenshots (dynamic-video campaign builder with fallback + "Generated Videos" list; the editor with Replace Video / Template / Customize `{firstname | there}` merge tags / Call-to-Action; the Edit Thumbnail dialog with logo search, caption and timestamp; the Dynamic Videos campaign table with # Videos / # Watched). The images are not stored in the repo; ask the user to re-attach them when this phase starts. They are a UX reference only — do not copy Sendspark branding or assets.

---

CLAUDE CODE — SMARTVIDEO AI PERSONALIZATION STUDIO
SENDSPARK-STYLE EXPERIENCE AND UI DESIGN

Repository: https://github.com/deangilmoreremix/remix-new-editor
Production: https://smartvid.app/

## Objective
Create a standalone Personalization Studio inside SmartVideo AI, using Sendspark's intuitive dynamic-video campaign experience as a functional and UX reference.
Reference: https://www.sendspark.com/video-platform
Do not copy Sendspark trademarks, proprietary images, branding, or exact interface assets. Use SmartVideo AI's existing design system.

## Important project status
The separate master personalization implementation is already underway. Do not restart it or interfere with currently authorized stages. Before making changes, inspect the latest code, current implementation progress, and all relevant existing components. This request initially authorizes an audit and design specification only. STOP after presenting the design for approval. Do not implement until explicitly authorized.

## Studio architecture
One standalone Personalization Studio accessible from the application's existing navigation, with five sections:
1. Video Library  2. Dynamic Videos  3. Templates  4. Campaigns  5. Analytics
Do not create duplicate libraries, databases, video players or backend services. These sections must connect to existing application functionality.

## Primary experience — "Create Personalized Campaign"
Guided flow:
- Step 1 — Select Video: choose a master video from the existing media library or use the existing Remotion Recorder.
- Step 2 — Add Prospects: existing Lead Finder, imported contacts, or CSV data; allow searching for businesses inside the studio.
- Step 3 — Personalize: existing Personalization Modal and Asset Finder. Support business names, customer names, company logos, website screenshots, website scrolling backgrounds, business photographs, presenter overlays, editable headlines, offers, CTA graphics, optional authorized voice or lip personalization. Provide a live recipient preview and a recipient selector. Retain Simple Mode by default, with optional Advanced Editing.
- Step 4 — Publish: existing publishing system. Recipient-specific watch links, CTA buttons, lead capture, branded pages, optional individual video rendering, thumbnail/GIF previews.
- Step 5 — Share: personalized video email blocks and HTML snippets using existing compatible tools. Only configured, authorized email sending integrations.
- Step 6 — Track: campaign analytics through the existing project analytics and audience infrastructure — views, watch time, CTA clicks, lead submissions, and heatmaps where those features are available and verified.

## Main screen design
Clean SaaS-style interface: concise studio header; Create Campaign primary action; recent campaign cards; video library access; campaign status indicators; basic engagement summary; search and filters.
Editor: left-side configuration panel; large video preview; recipient switching; visible progress steps; save status; Back/Continue; Preview and Publish actions.
Do not introduce a second timeline editor. Do not expose excessive technical controls in Simple Mode.

## Campaign management
Show: campaign name, master video, prospect count, personalized URLs generated, status, created date, video views, CTA clicks, leads, and actions to edit, preview and inspect analytics. Use actual database values, not placeholder statistics.

## Reuse requirements (no replacement implementations)
Personalization Modal (Simple/Advanced), Lead Finder, Asset Finder, Remotion compositions, Remotion Web Renderer, Remotion Recorder, Thumbnail Studio, media library, publishing and watch pages, video player, analytics, Audience and Retargeting, Supabase, Netlify.

## Design deliverables — first stage only
1. Existing-component audit. 2. Sendspark-inspired workflow comparison. 3. Complete Personalization Studio information architecture. 4. Dashboard layout. 5. Dynamic campaign creation screen design. 6. Personalization editor layout. 7. Campaign management layout. 8. Publishing and watch-page integration design. 9. Analytics layout. 10. Mobile and desktop design considerations. 11. Exact existing components and files to reuse. 12. New components genuinely required. 13. Implementation stages with testing requirements. 14. Identified overlaps with the master implementation currently underway.
STOP after delivering the design. Do not modify feature code yet.

## After design approval
Implement one approved stage at a time. For each stage: integrate real functionality; verify project persistence; test actual video previews and exports where applicable; verify ownership and RLS; record modified files; commit verified work to an authorized feature branch; provide manual testing instructions; STOP for explicit approval. No automatic progression. No production deployment without authorization.

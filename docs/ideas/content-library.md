# Content Library Studio

## Problem Statement

> **How might we build a global content library that lets every user type — internal, admin, and customer — browse, preview, and download PDFs and webinar video replays, using the same studio design language as the rest of the app?**

The application currently has no persistent place to store and access uploaded documents and video replays. The existing `LibraryPage` only tracks AI-generated images and videos in `localStorage`. Webinar recordings and PDFs are ephemeral — lost on refresh, not discoverable, and not consistent with the studio-based UX.

## Recommended Direction

Build a new **Content Library Studio** as a dedicated SPA route (`content-library`), following the exact same vanilla-DOM factory pattern as all other studios (`mountStudioChrome()`, Tailwind v4 + CSS variables, `.style-card` grid).

**Why this direction:**
- It matches the existing studio architecture directly — no React conversion needed, no new design system work.
- The `UploadPicker.js` and `uploadHistory.js` modules already handle multi-file selection and client-side thumbnail generation.
- A separate route keeps concerns clean: the existing `LibraryPage` stays focused on AI-generated content, while the new studio owns user uploads.

**Data layer choice (critical):** Do **not** use `localStorage`. At "hundreds+ of files regularly," you will hit the ~5MB limit immediately. Use Supabase Storage (`uploadFileToStorage()` in `src/lib/supabase.js` already exists) with a simple metadata table (`id`, `filename`, `type`, `url`, `size`, `uploaded_at`, `uploaded_by`). This also enables the global/public scope requirement — one bucket, accessible to all authenticated users.

**File type handling:**
- **PDFs:** Render an embedded preview (`<embed>` or `<iframe>` with the Supabase public URL) in the preview overlay. Show a document icon in the grid.
- **Videos:** Reuse `createSafeVideo()` from `security.js` and the existing video thumbnail extraction logic from `uploadHistory.js`.

**UI structure (mirrors existing studios):**
```
┌─────────────────────────────────┐
│  mountStudioChrome(...)         │
│  ┌───────────────────────────┐  │
│  │ Hero banner + title       │  │
│  │ "Content Library"         │  │
│  └───────────────────────────┘  │
│  [Upload Button]  [Filter: All │
│   | PDFs | Videos]  [Search]   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │ 📄 │ │ 🎬 │ │ 📄 │ │ 🎬 │  │
│  │PDF │ │VID │ │PDF │ │VID │  │
│  └────┘ └────┘ └────┘ └────┘  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │ ... │ │ ... │ │ ... │ │ ... │ │
│  └────┘ └────┘ └────┘ └────┘  │
└─────────────────────────────────┘
```

## Key Assumptions to Validate

- [ ] **Storage limit assumption:** Confirm Supabase Storage quota and CDN behavior for public URLs before building. Test with 500+ files to validate lazy-loading performance.
- [ ] **User behavior assumption:** Users will actually browse a flat grid at scale. If they need folders/tags within 2 weeks, the flat model is wrong — but add that only if validated.
- [ ] **PDF preview assumption:** Browser `<embed>` rendering of PDFs from Supabase public URLs works reliably across Chrome, Safari, and Firefox. If not, you need a PDF rendering service or download-only fallback.
- [ ] **Access control assumption:** "Global/public" means all authenticated users can view/download. If org-level isolation is needed later, the metadata schema needs an `org_id` column from day one.
- [ ] **Video format assumption:** Webinar exports are standard MP4/WebM. If they arrive as `.mov`, `.avi`, or other formats, client-side playback will break without a transcoding step.

## MVP Scope

**In:**
- New route `/content-library` registered in `studioRoutes.js` and `router.js`
- New component `src/components/ContentLibraryPage.js` following the vanilla-DOM factory pattern
- `mountStudioChrome()` with title "Content Library"
- Hero banner matching studio design (`.thumb-hero` or gradient banner)
- Multi-file upload button using `createUploadPicker()` with `accept=".pdf,video/*"`
- Responsive grid (`grid-cols-2 → 6`) using `.style-card` pattern
- Filter tabs: All | PDFs | Videos
- Full-screen preview overlay: PDF embed for documents, `<video controls>` for videos
- Download button in preview overlay
- Supabase Storage backend (`uploadFileToStorage()`) + new `contentLibrary` metadata table
- Server-side pagination or infinite scroll for 100+ files

**Out:**
- Folders, tags, or categories beyond the All/PDFs/Videos filter
- Search by filename (defer until users ask)
- Video transcoding (assume standard MP4)
- Access control / per-org isolation (start global, add later if needed)
- Analytics (who downloaded what)
- Comments or annotations
- PDF OCR / text extraction

## Not Doing (and Why)

- **Not extending the existing `LibraryPage`** — you asked for a separate page, and mixing generated content with user uploads creates confusing UX (different metadata, different preview behavior, different lifecycle).
- **Not building a full DAM system** — folders, tags, versioning, and access tiers are not requested. Add them only when users hit the pain point.
- **Not adding AI-powered search or transcripts** — scope creep. The MVP is view-and-download. Metadata extraction (Whisper transcripts, OCR) can be layered on top of the Supabase metadata table later.
- **Not using React for this component** — all existing studios are vanilla DOM factories. Introducing React here breaks architectural consistency and adds build complexity for no benefit.
- **Not storing files in `localStorage`** — the 5MB limit makes it non-viable for "hundreds+ of files." Supabase Storage is the right foundation.
- **Not auto-ingesting from calendars/Zoom** — you asked for a place to *upload* content. Auto-ingest is a separate feature; build it later if manual upload proves insufficient.

## Open Questions

- Should the upload be restricted to admins only, or open to all user types? If mixed, the UI needs role-aware rendering.
- Do webinar videos need a custom player (speed control, chapters, transcript sidebar), or is native `<video controls>` sufficient?
- Is there a file size limit? Large video files (>500MB) may need chunked upload or client-side compression.
- Should the existing `LibraryPage` filter tabs be updated to include the new content types, or kept completely separate?

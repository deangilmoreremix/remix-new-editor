# Personalization in the CineGen editor: Smart Text and Personalized Image

## Where a personalized image comes from
1. **Contacts** are made in the Personalization Studio (the Personalize window, Find a Business, discovery) and stored in this browser by `src/lib/contactStore.js` (`remix_contacts`, `remix_contact_profiles`, `remix_selected_contact_id`).
2. A contact's **profile** holds `contact`, `company`, `intelligence`, `social`, `personalization.business` and `personalization.assets` (`logos`, `identities` = the person's photo, `products`, `brandReferences`, `ctaGraphic`, `firstFrame`, `lastFrame`) plus `discoveredAssets` (images the image finder found on their website).
3. **Tokens** are defined once in `src/components/personalize/tokenSchema.js` (`TOKEN_DEFS`). Text tokens: `{{firstName}}`, `{{company}}`, `{{offer}}`... Image tokens: `{{logoUrl}}`, `{{avatarUrl}}` (also `{{image}}`, `{{photo}}`), `{{productImageUrl}}`, `{{brandImageUrl}}`, `{{ctaImageUrl}}`, `{{firstFrameUrl}}`, `{{lastFrameUrl}}`. `resolveToken(profile, key)` reads the contact's primary asset live.
4. **Smart Text** fills `{{tokens}}` (`resolveOverlayText`; also `{{d key "fallback"}}` and `{{up key}}`). **Personalized Image** (`overlay-personalized-image`, default `{{image}}`) shows the token's picture, else its Fallback image, else a grey placeholder, and applies the contact's crop focus and an optional logo backing plate (`src/lib/personalization/imageStyle.js`).

## How they are added in CineGen
Add to timeline, Overlays & forms: **Smart Text** and **Personalized Image**. In Personalized Image's settings pick the **source token** (one button per image token, each showing the chosen contact's real picture), a fallback image, fit and backing.

## Preview, export and links
- **Preview**: the "Preview as" picker in the viewer header chooses the contact. It uses the same `remix_selected_contact_id` the Personalize window uses (`src/cinegen/lib/personalize/preview-contact.ts`). "No contact" shows tokens as chips and a grey placeholder.
- **Export**: the Export tab's "Personalized output" renders one video per contact (`personalized-output.tsx`, `timelineToComposition(..., { profile })`).
- **Links**: personal share links carry `?c=<contactId>` plus the values the video uses (`perContact.js`).

## What the CineGen settings now do (ported from the classic editor)
`src/cinegen/lib/personalize/contact-image-services.ts`: the contact's pictures per token, the image finder's results as one-click picks, crop focus, "Make Video Ready" (needs the user's OpenAI key), and a one-time brightness check of the logo so "Backing: Auto" picks a light or dark plate.

## Still missing in CineGen (found, not built)
- The classic editor's one-click **personalized layouts** (Logo + CTA end card, presenter intro, product spotlight, opening frame: `PERSONALIZED_LAYOUTS` / `buildLayoutPlan` in `src/lib/personalization/timelineAssets.js`) and "Make all Video Ready".
- The classic editor also gives the settings an **upload**, **media library**, **stock search** and **sticker library** (`TimelineEditorPage.jsx` `addonEditorServices`); CineGen's overlay settings pass none of these yet, so the Image overlay has no upload or stock picker.
- Contacts and their pictures are stored in this browser only (localStorage).

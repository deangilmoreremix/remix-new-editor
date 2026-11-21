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

## Personalized layouts (Add to timeline, "Personalized layouts" tab)
Four one-click layouts from the contact being previewed, all built from tokens so every contact gets their own (`src/cinegen/lib/overlays/personalized-layouts.ts`, plans from `buildLayoutPlan` in `src/lib/personalization/timelineAssets.js`): **Logo + CTA end card**, **Presenter intro** (photo circle + "Hi {{d firstName "there"}}!"), **Product spotlight**, **Opening frame**. With no contact selected, or a contact with nothing to show, the tab says why. After adding, it reports how many other contacts have no picture for that layout yet.

## Image and Sticker overlay settings (ported from the classic editor)
`src/cinegen/lib/overlays/overlay-media-services.ts`: **Upload** (project storage, else a local preview that is not saved with the project), the project's own images (Media pool), **Pixabay / Pexels search** (a picked Pixabay image is copied to storage because Pixabay forbids hotlinking), and the **sticker library**.

## Make all Video Ready
A "✨ Make all Video Ready" button at the bottom of the Personalized layouts tab (and in the Personalized Image settings) cleans up every contact's picture for the slots this video's Personalized Images use, one at a time, with live progress (`makeAllVideoReady` in `src/cinegen/lib/personalize/contact-image-services.ts`). Pictures already Video Ready or missing are skipped; each call is a paid AI cleanup on the user's own OpenAI key; failures are counted and the reason is shown.

## Check contacts (Add to timeline, Personalized layouts tab, "Check contacts")
A table of every contact's picture for the slots this video's Personalized Images use (or the four main pictures when there are none), with chips "⚠ Missing", "AI", "AI · review", "✓ Ready" (`src/cinegen/lib/personalize/contact-check.ts`, `contact-check-panel.tsx`). Click a name to preview the video as that contact. AI pictures awaiting review have **Approve** and **Remove**. **Fill N with AI** makes the missing product / brand / opening / closing pictures from each contact's business details, one at a time, on the user's OpenAI key; they are saved marked "AI · review". Logos, photos and call-to-action graphics are never made with AI. A sign-in or key problem stops the run at once. The Export tab's Personalized output lists "AI picture needs review" for a contact until it is approved.

## Overlays lane
Lane blocks follow "Preview as": the text line under a block, the small picture of Smart Text and Personalized Image, and a lower third's name and title all use the previewed contact. The Add window's catalogue cards stay generic.

## Still missing in CineGen (found, not built)
- Stock search needs network access to Pixabay / Pexels; it was not run in the sandbox. Video Ready and Fill with AI need the user's OpenAI key and sign-in; only their failure paths were run here (Fill with AI reported "Image generation failed (500)" because the sandbox has no image service).
- Contacts and their pictures are stored in this browser only (localStorage).

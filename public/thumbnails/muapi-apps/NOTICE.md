# muapi Studio app cover images

The `.webp` images in this folder are the cover artwork for the apps on muapi's Studio "Apps" tab
(https://muapi.ai/studio?tab=apps). They are **muapi's artwork** (© Vadoo Internet Services Private Limited,
all rights reserved) and are used in this project **with muapi's permission, as confirmed by the project
owner on 2026-11-23**.

- Source: `https://cdn.muapi.ai/assets/<studio-slug>.webp`, resized to at most 800px (WebP, quality 82).
- Refresh or re-create them with `node scripts/fetch-muapi-app-thumbnails.mjs --force`.
- Do not relicense or redistribute these images apart from this project. If the permission changes or
  is withdrawn, delete this folder and the `thumbnail` fields in `src/data/muapiStudioAppsMap.json`.
- The written permission itself is not stored in this repo; keep that record with the project owner.

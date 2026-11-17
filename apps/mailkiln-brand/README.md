# Brand configuration

`brand.json` is the single source for the product name used by the embedded dashboard and the Help site.

- The vendored dashboard (`apps/warmbly-web`) and the vendored docs (`apps/mailkiln-help/content`, `upstream/`) stay exactly as upstream wrote them.
- At build time `rebrand-plugin.mjs` (dashboard) and `apps/mailkiln-help/build.mjs` + `agent-docs.mjs` (Help site and agent documents) replace the upstream product name in **user-facing prose only**.
- Technical identifiers are never rewritten: commands and binary names, `WARMBLY_*` settings, API paths and headers, storage keys, `data-warmbly-*` attributes, the `.warmbly.zip` export extension and anything in a code block. Rewriting those would break connections to a real upstream-compatible backend and make the documented instructions fail.
- Links to the original product's website, hosted app and community channels are removed or pointed at the in-app Help site. Links to its source repositories are kept as attribution.

## Changing the name

Edit `name` (and `slug` / `paths` if you rename the routes) in `brand.json`, then rebuild: `npm run build:mailkiln`. Regenerate the agent documents with `node apps/mailkiln-help/agent-docs.mjs`. The logo mark is `mark-path.txt`; `icons/` holds the favicon set (`node make-icons.cjs` regenerates it from `icons/icon.svg`).

## Known follow-ups

- Help pages describing upstream's commercial services (hosted Cloud plans, pricing, partnership, support channels) now read as if they were this product's. `apps/mailkiln-help/dist/assets/rebrand-report.json` lists every flagged page for a human to review.
- The in-dashboard product tour ships its own screenshots (`apps/warmbly-web/src/components/app/tour/shots`) that show the original logo. The tour is switched off in demo mode.
- "Mailkiln" is a working name. A quick web search found no product using it, but run a proper trademark and domain check before launch.

## Verifying we use upstream's true code

`npm run verify:upstream -- <path to a clone of the upstream repo at the commit in brand.json>` compares the vendored dashboard, docs and agent originals byte for byte and fails on any undocumented difference.

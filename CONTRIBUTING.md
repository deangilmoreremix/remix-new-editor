# Contributing to OpenMontage

Thank you for improving OpenMontage. We do not require a Contributor License Agreement (CLA), Developer Certificate of Origin sign-off, or any separate contribution contract.

By submitting a pull request, you confirm that you have the right to contribute its contents. Contributions must be compatible with the repository's [AGPLv3 license](LICENSE), and accepted contributions remain available under that license.

Please keep pull requests focused and include tests when behavior changes.

## Documenting studios and features

The SmartVideo app's studio catalog in `README.md`, `docs/STUDIOS_AND_PAGES.md` and `docs/STUDIO_FEATURE_CATALOG.md` is generated from the studio guides in `src/data/askKb/`. When you add or change a studio, page, feature or `apps/` folder, update its guide, run `npm run docs:studios`, and commit the result. `npm run check:docs` (part of `npm run lint`) fails when the docs are out of date.


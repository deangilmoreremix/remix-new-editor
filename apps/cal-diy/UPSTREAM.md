# Upstream source

Unmodified copy of https://github.com/calcom/cal.diy (MIT) at commit ae027bb
("chore: remove unused support chat env vars from .env.example (#30478)").
Not part of the root npm workspaces: it has its own Yarn 4 install and Postgres database.
See README.md here for setup. Do not edit files in this folder; update by re-copying from upstream.

## Local changes to upstream files
- `apps/web/calendso.yaml` lines 349-350: the sample Google OAuth access/refresh token values in the API example
  were replaced with `REDACTED_SAMPLE_TOKEN` because GitHub push protection blocks them. Docs only; no code impact.

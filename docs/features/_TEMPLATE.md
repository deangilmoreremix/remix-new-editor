---
name: Feature name
area: studio            # folder name this page lives in
status: live            # planned | beta | live | deprecated
added: YYYY-MM-DD
pr: owner/repo#123
route: /path or Menu > Submenu   # where a user finds it in the app
code:                   # key files/dirs; the index script checks these exist
  - src/components/Example.js
---

## What it does
2-3 sentences in plain user language.

## Where in the app
Exact navigation path, e.g. Studio > Edit > Face Swap.

## Depends on
API endpoints, models, env vars, DB tables, edge functions.

## How to test
Manual steps or the e2e spec path.

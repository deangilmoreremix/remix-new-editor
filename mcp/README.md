# SmartVid MCP server

Use SmartVid from Claude, Cursor or any MCP client: image, video, edit, effects, lip sync, cinema, commercial ads, audio, avatars, video tools, Timeline AI (fill gap, extend, watermark removal, layers, music), Zack D, text and vision, and the brand scraper.

## 1. Get a key
In SmartVid open **Settings → MCP access → Create MCP key**. First save your API keys in the same Settings screen: the key uses them. The key is shown once; revoke it there any time.

## 2. Install
Claude Code:
```bash
claude mcp add smartvid -e SMARTVID_API_KEY=sv_live_... -- node /path/to/remix-new-editor/mcp/index.js
```
Claude Desktop / Cursor:
```json
{
  "mcpServers": {
    "smartvid": {
      "command": "node",
      "args": ["/path/to/remix-new-editor/mcp/index.js"],
      "env": { "SMARTVID_API_KEY": "sv_live_..." }
    }
  }
}
```
Run `npm --prefix packages/studio-mcp-core install --workspaces=false` once to install the server's dependencies. Set `SMARTVID_API_URL` to point at a deploy preview.

## Tools
Discovery: `smartvid_list_studios`, `_search_models`, `_get_model`, `_estimate_cost`.
Generation: `_image_generate`, `_image_edit`, `_video_generate`, `_video_from_image`, `_video_to_video`, `_lipsync`, `_audio_generate`, `_video_tool`, `_avatar_generate`, `_motion_control`, `_recast`, `_motion_graphics`, `_marketing_ad`, `_text_generate`, `_vision_describe`.
Timeline AI: `_video_fill_gap`, `_video_extend`, `_video_remove_watermark`, `_image_layers`, `_music_create`.
Voice: `_voiceover_create`. Lead Finder and brand discovery: `_leads_list`, `_leads_save`, `_leads_update`, `_leads_delete`, `_businesses_find`, `_business_research`, `_business_contact_enrich`, `_brand_assets_discover`, `_brand_assets_status`, `_find_my_brand`. Zack D: `_zackd_trends`, `_zackd_script`, `_zackd_submit`, `_zackd_status`. Brand: `_brand_scrape`.
Video Pages: `_video_pages_templates`, `_list`, `_get`, `_create`, `_update`, `_publish`, `_unpublish`, `_delete`, `_stats`, `_contacts`, `_add_contacts`, `_remove_contact`. Social: `_social_accounts_list`, `_social_publish`, `_social_publish_status`. Account: `_usage_info`.
Director (needs your Director backend, `DIRECTOR_API_URL`): `_director_health`, `_config_check`, `_agents_list`, `_run_agent`, `_chat`, `_workflow`, `_collections_list`, `_collection_get`, `_collection_create`, `_collection_delete`, `_media_list`, `_media_get`, `_media_url`, `_media_delete`, `_upload`, `_sessions_list`, `_session_get`, `_session_delete`. The gateway keeps each key owner's collections and sessions apart; see DEPLOY.md.
Open tabs: `_studio_sessions`, `_studio_call`, `_studio_result` run tools of a studio open in your browser (timeline, workbench, motion director, render queue, brand store, app navigation). The full list is `mcp/bridge-tools.json`; each tool's risk is shown in the page when it asks. Off until you click "Let MCP control this tab".
Safeguards: actions that delete or publish need `confirm: true`, are capped per key per day and are audited. Saving API keys, creating keys, checkout and connecting social accounts are never tools.
Jobs and account: `_get_result`, `_upload_file`, `_account_balance`.

Flow: `search_models` → `get_model` (exact fields) → a generation tool with `{ model, inputs }`. Media inputs are public https URLs; `upload_file` re-hosts a URL. Long jobs return a `request_id` for `get_result`.

## Deploying and checking it live
`mcp/DEPLOY.md` is the checklist (migration, `MCP_KEY_SECRET`, preview, key, smoke run). `npm run mcp:smoke` runs one cheapest call per model kind and per custom tool, refuses to spend without `--confirm-spend <max> --yes`, and `npm run mcp:coverage` turns the results into the Live column of `mcp/COVERAGE.md`.

## Which studios are covered
`mcp/studios.json` classifies every studio in the app: the tools that serve it, or the reason it is not exposed. A test (`tests/mcp/studio-coverage.test.js`) fails when a studio is added to the app without being classified.

`mcp/COVERAGE.md` also lists every feature under its studio, with the reason for anything not exposed (content library, generation history, website builder, CineGen desktop export, Video Agent iframe). Live status is "not run" until a real smoke run.

## How it works
`mcp/index.js` (brand: `mcp/brand.js`) uses `packages/studio-mcp-core`, which calls the gateway `netlify/functions/mcp-gateway.js` (`/api/mcp-gateway`). The gateway checks the MCP key (`netlify/functions/mcp-keys.js`, table `mcp_keys`: hash only; your saved API keys are stored encrypted with `MCP_KEY_SECRET`), then calls the same functions the app uses, as you.
Regenerate the catalog after model changes: `npm run mcp:catalog`. Tests: `npm run test:mcp`.

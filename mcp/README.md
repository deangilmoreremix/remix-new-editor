# SmartVid MCP server

Use every SmartVid studio (image, video, edit, effects, lip sync, cinema, audio, avatar, video tools, training, chat) from Claude, Cursor or any MCP client.

## Install (Claude Code)
```bash
claude mcp add smartvid -e SMARTVID_API_KEY=your_key -- node /path/to/remix-new-editor/mcp/index.js
```

## Claude Desktop / Cursor
```json
{
  "mcpServers": {
    "smartvid": {
      "command": "node",
      "args": ["/path/to/remix-new-editor/mcp/index.js"],
      "env": { "SMARTVID_API_KEY": "your_key" }
    }
  }
}
```
Run `npm --prefix packages/studio-mcp-core install --workspaces=false` once to install the server's dependencies.

## Tools
`smartvid_list_studios`, `_search_models`, `_get_model`, `_estimate_cost`, `_image_generate`, `_image_edit`, `_video_generate`, `_video_from_image`, `_video_to_video`, `_lipsync`, `_audio_generate`, `_video_tool`, `_avatar_generate`, `_model_train`, `_text_generate`, `_get_result`, `_upload_file`, `_account_balance`.

Flow: `search_models` → `get_model` (see the exact fields) → a generation tool with `{ model, inputs }`. Media inputs are public https URLs; `upload_file` re-hosts a URL. Long jobs return a `request_id` for `get_result`.

## How it works
`mcp/index.js` (brand: `mcp/brand.js`) uses `packages/studio-mcp-core`, which calls the gateway `netlify/functions/mcp-gateway.js` (`/api/mcp-gateway`). The key is bring-your-own and used per request only. Regenerate the catalog after model changes: `npm run mcp:catalog`. Tests: `npm run test:mcp`.

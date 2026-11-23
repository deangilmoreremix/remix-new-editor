# smartvid-mcp

Use SmartVid from Claude, Cursor and any other MCP app: generate images, video and audio, run the studios, and (with an open SmartVid tab) edit your timeline.

## 1. Get a key
Sign in to SmartVid, open **Settings → MCP access** and choose **Create MCP key**. Copy it; it is shown once. Your key uses the API keys you saved in Settings.

## 2. Add it to your MCP app

### Claude Code (nothing to install)
```bash
claude mcp add --transport http smartvid https://smartvid.app/api/mcp --header "Authorization: Bearer sv_live_YOUR_KEY"
```

### Claude Code (local, via npx)
```bash
claude mcp add smartvid -e SMARTVID_API_KEY=sv_live_YOUR_KEY -- npx -y smartvid-mcp
```

### Claude Desktop / Cursor
```json
{
  "mcpServers": {
    "smartvid": {
      "command": "npx",
      "args": ["-y", "smartvid-mcp"],
      "env": { "SMARTVID_API_KEY": "sv_live_YOUR_KEY" }
    }
  }
}
```

## Settings
| Variable | Purpose |
|---|---|
| `SMARTVID_API_KEY` | Your MCP key (required). |
| `SMARTVID_API_URL` | Use another SmartVid address, for example a preview deployment (optional). |

Needs Node 22 or newer.

## Safety
Anything that deletes, overwrites or publishes needs `confirm: true` and is capped per day. Saving API keys, checkout and connecting accounts can only be done by you in the app. Revoke or rotate a key any time in Settings → MCP access.

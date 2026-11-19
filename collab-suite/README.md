# Collab Suite

Standalone collaboration apps (Teamchat, Calendar, Contacts, Meetings, Email, Signatures). Independent of SmartVideo: no imports from it, its own `package.json`, move this folder into its own repo as-is.

```
npm install
npm run dev            # launcher on :3200
cd apps/calendar && npm run dev   # any app standalone
npm run typecheck
```

Data lives in the browser (localStorage via `@collab/core` `useStore`). Status:

| App | State |
|---|---|
| Contacts, Calendar, Signatures | working, local only |
| Teamchat | working; live sync between tabs only. Needs a realtime backend for multi-user |
| Meetings | camera preview only. Needs WebRTC + signaling server |
| Email | local drafts only. Needs an SMTP/IMAP or provider-API backend |

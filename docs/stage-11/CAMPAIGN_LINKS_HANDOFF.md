# What the campaigns branch must do (origin/claude/modest-tesla-yhjel6)

Attribution only happens for links of the form `/watch/<video id>?cr=<campaign_recipients.public_token>` (or `/v/<business>/<slug>?cr=<token>`), where the recipient is `ready` and the campaign, recipient and published video belong to the same owner. A campaign id in the URL is ignored on purpose (ids are not secrets).

1. Build recipient links with the watch URL plus `?cr=<public_token>` instead of (or in addition to) `/p/<token>`.
2. Its `/p/<token>` page plays `output_video_url` directly and records no analytics. Either redirect it to the watch URL with `?cr=<token>` or embed `createAnalytics({ videoId, recipientToken })` from `src/lib/editor/publish/analyticsClient.js` with `heatmapCapture`.
3. The recipient's video must be a published video (a `published_videos` row) for the same owner.

Not changed in this PR because that code is not in this branch.

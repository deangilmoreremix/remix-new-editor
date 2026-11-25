# SmartVideo promo videos (portable package)

Every `*.mp4` here is H.264 High, yuv420p, limited range (BT.709), constant 30 fps, `+faststart`, AAC 128 kbps 48 kHz audio. 1920x1080.
`<id>.mp4` is the with-music version; `<id>-nobgm.mp4` / `v5-tour-nomusic.mp4` keep the sound effects but have no music bed.
Each video has `<id>.poster.jpg` and `<id>.poster.webp`. `manifest.json` lists size, duration, sha256, source and open review items per file.

Usage:
    <video autoplay muted loop playsinline preload="metadata" poster="v1-hero.poster.jpg"><source src="v1-hero.mp4" type="video/mp4"></video>
(The V3 clips do not loop cleanly: use the poster and play once.)

What is burned into the picture: captions and titles (see `captions_burned_in` in the manifest). They are part of the video, not subtitles.
Honesty notes: nothing here is a live generation. V1-V3 animate real app captures (typing and clicks are simulated reveals); V2's Backlot shot is a fictional seeded project; V5 is a real screen recording where Generate is only hovered.
Music: house-vibez (Lily J, Mixkit). SFX: only the skill-bundled set; keyboard, riser, sparkle and whoosh-big have untraceable sources.
Open items: no person has auditioned the audio; V5 has not had its independent review; V4 (9:16 social cut) does not exist yet.

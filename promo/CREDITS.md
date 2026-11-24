# Audio credits (V1 and V2)

This replaces the requested FREESOUND-CREDITS.md: Freesound is blocked in this sandbox, so no Freesound SFX were used. Only audio bundled with the
video-shotcraft skill is used; records come from the skill's own attribution files and are NOT all individually verified.

## Music
- `public/audio/bgm.mp3` = house-vibez.mp3, "House Vibez" by Lily J, Mixkit, Mixkit Stock Music Free License per the skill's `assets/audio/ATTRIBUTION.md`
  (source URL recorded there: https://assets.mixkit.co/music/745/745.mp3). Licence not independently re-checked.

## SFX (from skill `template/public/audio/ATTRIBUTION.md`, legacy records)
| file | record |
|---|---|
| transition-soft.mp3 | Mixkit SFX Free License, "Air zoom vacuum" (sfx 2608) |
| whoosh-fast.mp3 | Mixkit SFX Free License, "Fast whoosh transition" (sfx 1490) |
| impact-cine.mp3 | Mixkit SFX Free License, "Cinematic whoosh deep impact" (sfx 1143) |
| keyboard.mp3 | legacy record says Mixkit; original entry cannot be traced. Verify or replace before publishing |
| riser-cine.mp3 | legacy record says Mixkit; original entry cannot be traced. Verify or replace before publishing |
| sparkle.mp3 | legacy record says Mixkit; original entry cannot be traced. Verify or replace before publishing |
| whoosh-big.mp3 | legacy record says Mixkit; original entry cannot be traced. Verify or replace before publishing |
| click-camera.mp3 (V2) | Mixkit SFX Free License, "Camera shutter click" (sfx 1133) |
| swoosh-quick.mp3 (V2) | Mixkit SFX Free License, "Fast small sweep transition" (sfx 166) |
| transition-snap.mp3 (V2) | Mixkit SFX Free License, "Fast transitions swoosh" (sfx 3115) |

None of the SFX or the BGM were auditioned by a person (no audio device); placement and level were verified by waveform cross-correlation only.

## Measured pipeline offset
Remotion 4.0.484, mp4/AAC 48 kHz: output audio is +1.28 f late (7 SFX probes, 1.28-1.29 f; BGM 1.34 f). Compensated in `src/timeline.ts`
(`OUTPUT_AUDIO_OFFSET_F`); `analysis/verify_sync.py` prints offsets relative to the compensated `from`, so it shows ~1.28 f for SFX (the encoder delay, as expected). The residual vs target is therefore derived: integer rounding of `from` leaves each SFX within about 0.5 f of target. BGM measured +0.34 f.

## File hashes (SHA-256, first 16 hex chars) of the audio files used by V1/V2
- eff4aceea32ed5f9 bgm.mp3
- 042d01db7a4a0c49 click-camera.mp3
- 9854bff8a78fcebe impact-cine.mp3
- 152f78c3bff50cf0 keyboard.mp3
- 385340df21a87da8 riser-cine.mp3
- c4ee1a64554bd413 sparkle.mp3
- 5d8153579cfbd4ec swoosh-quick.mp3
- 9f7e4edb094569f9 transition-snap.mp3
- 0e25921648c66e30 transition-soft.mp3
- 8af9843a636d3b49 whoosh-big.mp3
- b88fd5d484251930 whoosh-fast.mp3

The SFX are the MP3 files bundled with the skill (not Freesound previews); analysis of peak positions is in `analysis/sfx_peaks.json`.

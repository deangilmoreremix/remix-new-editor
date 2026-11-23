#!/bin/bash
# Re-creates project/public/cap from ../captures (kept out of git to avoid duplicating the captures).
set -e; cd "$(dirname "$0")"; C=../captures; mkdir -p public/cap public/audio
cp $C/01-hero-video-studio/hero-video-studio-2x.png public/cap/s01.png; cp $C/01-hero-video-studio/typing-prompt.mp4 public/cap/s01-typing.mp4; cp $C/01-hero-video-studio/hero-vertical-2160x3840.png public/cap/s01v.png
cp $C/02-apps-hub/apps-hub.png public/cap/s02.png; cp $C/03-model-picker/model-picker-scroll.mp4 public/cap/s03-picker.mp4
cp $C/04-image-studio/image-studio-2x.png public/cap/s04.png; cp $C/04-image-studio/typing-prompt.mp4 public/cap/s04-typing.mp4
cp $C/05a-cinema-studio/cinema-studio-2x.png public/cap/s05a.png; cp $C/05b-director/director-2x.png public/cap/s05b.png
cp $C/06a-storyboard/storyboard.png public/cap/s06.png; cp $C/06a-storyboard/storyboard-vertical-2160x3840.png public/cap/s06v.png
cp $C/07a-edit-tools/edit-tools-2x.png public/cap/s07.png; cp $C/07a-edit-tools/edit-vertical-2160x3840.png public/cap/s07v.png
cp $C/08a-character/character.png public/cap/s08a.png; cp $C/08b-influencer/influencer.png public/cap/s08b.png
cp $C/09a-avatar/avatar-2x.png public/cap/s09a.png; cp $C/09a-avatar/avatar-vertical-2160x3840.png public/cap/s09av.png
cp $C/09b-lipsync/lipsync-2x.png public/cap/s09b.png; cp $C/09b-lipsync/lipsync-vertical-2160x3840.png public/cap/s09bv.png
cp $C/10a-ai-vfx/ai-vfx.png public/cap/s10a.png; cp $C/10b-effects/effects.png public/cap/s10b.png; cp $C/11a-workbench/workbench.png public/cap/s11.png
cp $C/12a-templates/templates.png public/cap/s12.png; cp $C/13-video-agent/video-agent-2x.png public/cap/s13.png; cp $C/15b-community/community.png public/cap/s15.png
cp ../../.claude/skills/video-shotcraft/assets/audio/bgm/house-vibez.mp3 public/audio/bgm.mp3

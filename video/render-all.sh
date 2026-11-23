#!/bin/bash
cd /home/user/remix-new-editor/video/project
R="npx remotion render src/index.ts"
O=../out
for v in true false; do
  suf=""; [ $v = false ] && suf="-nobgm"
  $R HeroLoop $O/hero-loop$suf.mp4 --props="{\"bgm\":$v}" --crf=22 --concurrency=4
  $R FeatureReel $O/feature-reel$suf.mp4 --props="{\"bgm\":$v}" --crf=24 --concurrency=4
  $R Social $O/social-9x16$suf.mp4 --props="{\"bgm\":$v}" --crf=23 --concurrency=4
done
for id in c01-video c02-apps c03-models c04-image c05-cinema-director c06-storyboard c07-edit c08-character-influencer c09-avatar-lipsync c10-vfx-effects c11-workbench c12-templates c13-video-agent c15-community; do
  $R $id $O/$id.mp4 --crf=26 --concurrency=4
done
echo ALLDONE

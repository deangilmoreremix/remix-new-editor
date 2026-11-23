#!/bin/bash
cd /home/user/remix-new-editor/video/project
R="npx remotion render src/index.ts"; O=../out
for v in true false; do suf=""; [ $v = false ] && suf="-nobgm"
  $R HeroLoop $O/hero-loop$suf.mp4 --props="{\"bgm\":$v}" --crf=22 --concurrency=1
  $R FeatureReel $O/feature-reel$suf.mp4 --props="{\"bgm\":$v}" --crf=24 --concurrency=1
done
for id in c02-apps c13-video-agent c15-community; do $R $id $O/$id.mp4 --crf=26 --concurrency=1; done
echo FIXDONE

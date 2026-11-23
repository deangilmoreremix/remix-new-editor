#!/usr/bin/env bash
# Generates the small motion-graphic clips and the thumbnails behind the Analytics DEMO videos
# (public/analytics-demo/). Needs ffmpeg with libx264 and drawtext, and the Inter font.
#
#   bash scripts/generate-analytics-demo-media.sh
#
# The clips are plain title-card videos with a "DEMO" tag; the call-to-action buttons are drawn into the picture the
# way a finished SmartVideo ad draws them (the player adds the transparent tap target on top). Where each button sits
# is shared with src/lib/editor/projectLibrary/analytics/demo/demoVideos.js (BUTTON_* positions): keep the two in sync.
# The thumbnails are a mock of the watch page (the video centred on a dark page, 1.6 : 1, the same shape the Heatmaps backdrop uses),
# so nothing is cropped and the heat clusters in demoVideos.js can be given in page coordinates.
# The third demo reuses the Video Outreach sample presenter (public/media/outreach-sample/presenter.mp4) as is;
# only its thumbnail is made here.
set -euo pipefail
cd "$(dirname "$0")/.."

FONT="${FONT:-/usr/share/fonts/opentype/inter/Inter-Bold.otf}"
FONT_REG="${FONT_REG:-/usr/share/fonts/opentype/inter/Inter-Medium.otf}"
OUT="public/analytics-demo"
mkdir -p "$OUT"

# text <font> <size> <colour> <text> <y-expression> <start> <end>  -> one fading-in drawtext filter, centred
text() {
  printf "drawtext=fontfile=%s:text='%s':fontsize=%s:fontcolor=%s:x=(w-text_w)/2:y=%s:alpha='min(1,max(0,(t-%s)/0.4))':enable='between(t,%s,%s)'" \
    "$1" "$4" "$2" "$3" "$5" "$6" "$6" "$7"
}
# tint <colour> <start> <end> -> full-frame colour wash for one section
tint() { printf "drawbox=x=0:y=0:w=iw:h=ih:color=%s@0.62:t=fill:enable='between(t,%s,%s)'" "$1" "$2" "$3"; }
# button <x> <y> <w> <h> <fill> <label> <fontsize> <start> <end>
button() {
  printf "drawbox=x=%s:y=%s:w=%s:h=%s:color=%s:t=fill:enable='between(t,%s,%s)',drawtext=fontfile=%s:text='%s':fontsize=%s:fontcolor=0x111827:x=%s+(%s-text_w)/2:y=%s+(%s-text_h)/2:enable='between(t,%s,%s)'" \
    "$1" "$2" "$3" "$4" "$5" "$8" "$9" "$FONT" "$6" "$7" "$1" "$3" "$2" "$4" "$8" "$9"
}
demo_tag() { printf "drawbox=x=24:y=24:w=104:h=40:color=0x000000@0.6:t=fill,drawtext=fontfile=%s:text='DEMO':fontsize=24:fontcolor=white:x=24+(104-text_w)/2:y=24+(40-text_h)/2" "$FONT"; }

# page_mock <frame.jpg> <frame width> <frame height> <out.jpg> : the frame centred on a 1280x800 page, saved at 800x500
page_mock() {
  local x=$(( (1280 - $2) / 2 )) y=$(( (800 - $3) / 2 ))
  ffmpeg -v error -y -f lavfi -i "color=c=0x0b1220:s=1280x800" -i "$1" \
    -filter_complex "[1]scale=$2:$3[v];[0][v]overlay=$x:$y,scale=800:500" -frames:v 1 -q:v 4 "$4"
}
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------- A: local business lead ad, 16:9, 30 s
# Button: centre 50% / 76%, 34% wide, 3:1  ->  435 x 145 px at x=423, y=475 (1280x720)
A_VF="$(
  tint 0x1d4ed8 0 6; echo -n ','
  tint 0x9a3412 6 14; echo -n ','
  tint 0x047857 14 22; echo -n ','
  tint 0x6d28d9 22 27; echo -n ','
  tint 0x0f172a 27 30; echo -n ','
  text "$FONT" 72 white 'Is your roof ready for spring?' '(h-text_h)/2-20' 0 6; echo -n ','
  text "$FONT_REG" 34 white 'Bright Roofing Co.' '(h/2)+60' 0.6 6; echo -n ','
  text "$FONT" 66 white 'Leaks. Missing shingles. Storm damage.' '(h-text_h)/2' 6 14; echo -n ','
  text "$FONT" 76 white 'Free roof inspection' '(h-text_h)/2-30' 14 22; echo -n ','
  text "$FONT_REG" 38 white 'and a written quote in 24 hours' '(h/2)+50' 14.6 22; echo -n ','
  text "$FONT" 76 white '500+ roofs repaired' '(h-text_h)/2-30' 22 27; echo -n ','
  text "$FONT_REG" 38 white 'Rated 5 stars by local homeowners' '(h/2)+50' 22.6 27; echo -n ','
  text "$FONT" 64 white 'Get your free quote today' '170' 27 30; echo -n ','
  button 423 475 435 145 0xf59e0b 'Get my free quote' 38 27.4 30; echo -n ','
  text "$FONT_REG" 30 white 'or call 555 0142' '650' 27.8 30; echo -n ','
  demo_tag
)"
ffmpeg -v error -y -f lavfi -i "gradients=s=1280x720:d=30:r=24:speed=0.012:c0=0x0ea5e9:c1=0x1e293b:c2=0xf59e0b:nb_colors=3" \
  -vf "$A_VF,format=yuv420p" -c:v libx264 -preset slow -crf 30 -movflags +faststart -an "$OUT/roofing-quote-ad.mp4"
ffmpeg -v error -y -ss 29 -i "$OUT/roofing-quote-ad.mp4" -frames:v 1 "$TMP/a.png"
page_mock "$TMP/a.png" 1000 562 "$OUT/roofing-quote-ad.jpg"   # frame at x=140, y=119 of the page

# ---------------------------------------------------------------- B: vertical product teaser, 9:16, 20 s
# Button: centre 50% / 80%, 70% wide, 3:1  ->  504 x 168 px at x=108, y=940 (720x1280)
B_VF="$(
  tint 0xbe185d 0 4; echo -n ','
  tint 0x0e7490 4 10; echo -n ','
  tint 0x4d7c0f 10 16; echo -n ','
  tint 0x0f172a 16 20; echo -n ','
  text "$FONT" 86 white 'Stop scrolling.' '(h-text_h)/2' 0 4; echo -n ','
  text "$FONT" 64 white 'Meet Aurora Serum' '(h-text_h)/2-50' 4 10; echo -n ','
  text "$FONT_REG" 40 white 'Light. Fragrance free.' '(h/2)+40' 4.6 10; echo -n ','
  text "$FONT" 64 white 'Loved by' '(h-text_h)/2-70' 10 16; echo -n ','
  text "$FONT" 64 white '2000+ customers' '(h/2)+10' 10.4 16; echo -n ','
  text "$FONT" 62 white 'Limited offer today' '300' 16 20; echo -n ','
  button 108 940 504 168 0xf472b6 'Shop now' 52 16.4 20; echo -n ','
  demo_tag
)"
ffmpeg -v error -y -f lavfi -i "gradients=s=720x1280:d=20:r=24:speed=0.012:c0=0xec4899:c1=0x1e293b:c2=0x06b6d4:nb_colors=3" \
  -vf "$B_VF,format=yuv420p" -c:v libx264 -preset slow -crf 30 -movflags +faststart -an "$OUT/serum-vertical-ad.mp4"
ffmpeg -v error -y -ss 19 -i "$OUT/serum-vertical-ad.mp4" -frames:v 1 "$TMP/b.png"
page_mock "$TMP/b.png" 405 720 "$OUT/serum-vertical-ad.jpg"   # frame at x=437, y=40 of the page

# ---------------------------------------------------------------- C: personalized outreach (existing sample presenter, 720x720, 26.5 s)
# The "Book a call" link is an overlay the player draws on the video; the thumbnail shows it at the same place
# (left 30%, top 78%, width 40%, height 12% of the frame -> 216, 562, 288 x 86 px).
C_VF="drawbox=x=216:y=562:w=288:h=86:color=0xfacc15@0.95:t=fill,drawtext=fontfile=$FONT:text='Book a call':fontsize=34:fontcolor=0x111827:x=216+(288-text_w)/2:y=562+(86-text_h)/2"
ffmpeg -v error -y -ss 22 -i public/media/outreach-sample/presenter.mp4 -frames:v 1 -vf "$C_VF" "$TMP/c.png"
page_mock "$TMP/c.png" 640 640 "$OUT/personal-outreach.jpg"   # frame at x=320, y=80 of the page

ls -la "$OUT"

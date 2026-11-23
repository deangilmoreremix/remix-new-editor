#!/bin/bash
# usage: strip.sh in.mp4 out.png t1 t2 ... (seconds)
in=$1; out=$2; shift 2; i=0; rm -f /tmp/claude-0/pw/fr/s_*.png
for t in "$@"; do ffmpeg -v error -y -ss $t -i $in -frames:v 1 -vf "scale=640:-1" /tmp/claude-0/pw/fr/s_$(printf %02d $i).png; i=$((i+1)); done
n=$i; cols=4; rows=$(( (n+cols-1)/cols ))
ffmpeg -v error -y -pattern_type glob -i '/tmp/claude-0/pw/fr/s_*.png' -vf "tile=${cols}x${rows}" -frames:v 1 $out

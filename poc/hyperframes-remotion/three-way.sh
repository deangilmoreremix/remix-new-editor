#!/bin/bash
# three-way.sh <player.png> <remotion.png> <native.png> <x:y:w:h in 960x540 space> <out-prefix>
# Crops the same region from Player, Remotion (alpha flattened on white) and native; prints pairwise SSIM.
P=$1; R=$2; N=$3; C=$4; O=$5; IFS=: read x y w h <<< "$C"
ffmpeg -y -loglevel error -i "$P" -vf "scale=960:540,crop=$w:$h:$x:$y" ${O}_player.png
ffmpeg -y -loglevel error -f lavfi -i color=white:s=960x540 -i "$R" -filter_complex "[0][1]overlay,crop=$w:$h:$x:$y" -frames:v 1 ${O}_remotion.png
ffmpeg -y -loglevel error -i "$N" -vf "scale=960:540,crop=$w:$h:$x:$y" ${O}_native.png
s(){ ffmpeg -loglevel info -i "$1" -i "$2" -lavfi ssim -f null - 2>&1 | grep -o "All:[0-9.]*" | sed 's/All://'; }
echo "player-vs-native=$(s ${O}_player.png ${O}_native.png) remotion-vs-native=$(s ${O}_remotion.png ${O}_native.png) player-vs-remotion=$(s ${O}_player.png ${O}_remotion.png)"

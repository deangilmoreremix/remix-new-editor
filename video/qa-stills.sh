#!/bin/bash
# usage: qa-stills.sh <comp> <frame>...
c=$1; shift; mkdir -p ../qa/$c
for f in "$@"; do npx remotion still src/index.ts $c ../qa/$c/f$(printf %04d $f).png --frame=$f >/dev/null 2>&1 & done; wait

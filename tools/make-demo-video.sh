#!/bin/zsh
# Stitches the clips recorded by e2e/demo-video.spec.ts into docs/demo/billsplit-demo.mp4 (+ a smaller .gif for the README).
# Needs ffmpeg (brew install ffmpeg).
set -euo pipefail
ROOT=${0:A:h:h}
IN="$ROOT/.demo-clips"
OUT="$ROOT/docs/demo"
mkdir -p "$OUT"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

i=0; : > "$TMP/list.txt"
while IFS=$'\t' read -r video from to; do
  i=$((i+1))
  ffmpeg -nostdin -loglevel error -y -ss "$from" -to "$to" -i "$video" -vf "fps=30,scale=1280:800" -an \
    -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p "$TMP/$i.mp4"
  echo "file '$TMP/$i.mp4'" >> "$TMP/list.txt"
done < <(python3 -I -c 'import json,sys
for c in json.load(open(sys.argv[1])): print(c["video"], max(c["from"],0), c["to"], sep="\t")' "$IN/segments.json")

ffmpeg -nostdin -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy -movflags +faststart "$OUT/billsplit-demo.mp4"
ffmpeg -nostdin -loglevel error -y -i "$OUT/billsplit-demo.mp4" \
  -vf "fps=10,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  "$OUT/billsplit-demo.gif"
ls -lh "$OUT"

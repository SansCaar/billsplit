#!/bin/zsh
# Install or update the Bill Split Chrome extension (macOS) from GitHub Releases.
#
#   curl -fsSL https://raw.githubusercontent.com/SansCaar/billsplit/main/tools/install-extension.sh | zsh
#
# Downloads the latest release into ~/Bill Split Extension. Chrome doesn't let scripts install
# extensions from outside the Web Store, so the first time you load that folder yourself
# ("Load unpacked"); after that, rerun this script and click reload on the extension in Chrome.
#
# While the repo is private, set GITHUB_TOKEN (or be logged in with `gh`).
# Run it as a file to pick a release (install-extension.sh ext-v0.2.0) or a local zip (--zip file.zip).
set -euo pipefail

REPO="SansCaar/billsplit"
EXT="$HOME/Bill Split Extension"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

TOKEN=${GITHUB_TOKEN:-$(gh auth token 2>/dev/null || true)}
AUTH=(); [[ -n "$TOKEN" ]] && AUTH=(-H "Authorization: Bearer $TOKEN")
gh_api() { curl -fsSL "${AUTH[@]}" -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }
json() { plutil -extract "$1" raw -o - "$2" 2>/dev/null || true; }

INSTALLED=$(json version "$EXT/manifest.json")

# 1. Download
if [[ "${1:-}" == "--zip" ]]; then
  cp "$2" "$TMP/ext.zip"
else
  if [[ -n "${1:-}" ]]; then URL="https://api.github.com/repos/$REPO/releases/tags/$1"
  else URL="https://api.github.com/repos/$REPO/releases/latest"; fi
  gh_api "$URL" -o "$TMP/release.json" || {
    echo "✗ Couldn't find the release on GitHub. If the repo is private, set GITHUB_TOKEN or run 'gh auth login'."
    exit 1
  }
  TAG=$(json tag_name "$TMP/release.json")
  ASSET=""
  for i in {0..19}; do
    name=$(json "assets.$i.name" "$TMP/release.json")
    [[ -z "$name" ]] && break
    [[ "$name" == billsplit-extension-*.zip ]] && { ASSET=$(json "assets.$i.url" "$TMP/release.json"); break; }
  done
  [[ -n "$ASSET" ]] || { echo "✗ Release $TAG has no billsplit-extension zip"; exit 1; }
  echo "› Downloading Bill Split $TAG…"
  gh_api -H "Accept: application/octet-stream" "$ASSET" -o "$TMP/ext.zip"
fi

# 2. Unpack into a scratch folder, check it, then replace the installed copy
mkdir "$TMP/unpacked"
unzip -q "$TMP/ext.zip" -d "$TMP/unpacked"
[[ -f "$TMP/unpacked/manifest.json" ]] || { echo "✗ The download has no manifest.json"; exit 1; }
mkdir -p "$EXT"
rsync -a --delete "$TMP/unpacked/" "$EXT/"
VERSION=$(json version "$EXT/manifest.json")

# 3. Open Chrome's extensions page and tell the user what to click
open_chrome() { open -Ra "Google Chrome" 2>/dev/null && open -a "Google Chrome" "chrome://extensions" 2>/dev/null; }
# Wait for Enter so the user can read the steps first. Reads the terminal, not stdin, because with
# `curl | zsh` stdin is this script. Returns 0 straight away if there is no terminal.
wait_enter() {
  { exec 3</dev/tty; } 2>/dev/null || return 0
  printf "\n  Press Enter to open Chrome… "
  read -r -u 3 || true
  exec 3<&-
}

if [[ -n "$INSTALLED" ]]; then
  echo "✓ Updated Bill Split ${INSTALLED} → ${VERSION} in $EXT"
  echo
  echo "  In chrome://extensions, click ↻ on Bill Split (or restart Chrome)."
  wait_enter
  open_chrome || true
else
  echo "✓ Bill Split $VERSION downloaded to $EXT"
  echo
  echo "  One-time setup in Chrome:"
  echo "    1. Turn on Developer mode (top right of chrome://extensions)"
  echo "    2. Drag the 'Bill Split Extension' folder from the Finder window onto the page"
  echo "       (or click Load unpacked, press ⌘⇧G and paste the path; it's on your clipboard)"
  echo
  echo "  To update later, run this command again."
  printf %s "$EXT" | pbcopy 2>/dev/null || true
  wait_enter
  open -R "$EXT" 2>/dev/null || true
  open_chrome || echo "  (Couldn't find Google Chrome. Open chrome://extensions in Chrome yourself.)"
fi

#!/bin/zsh
# Install or update the Bill Split Chrome extension (macOS) from GitHub Releases.
#
#   curl -fsSL https://raw.githubusercontent.com/SansCaar/billsplit/main/tools/install-extension.sh | zsh
#
# Downloads the latest release into ~/.billsplit/extension. Chrome doesn't let scripts install
# extensions from outside the Web Store, so the first time you load that folder yourself
# ("Load unpacked"); after that, rerun this script and click reload on the extension in Chrome.
#
# While the repo is private, set GITHUB_TOKEN (or be logged in with `gh`).
# Run it as a file to pick a release (install-extension.sh ext-v0.2.0) or a local zip (--zip file.zip).
set -euo pipefail

REPO="SansCaar/billsplit"
EXT="$HOME/.billsplit/extension"
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

# 3. Tell the user how to load it
if [[ -n "$INSTALLED" ]]; then
  echo "✓ Updated Bill Split ${INSTALLED} → ${VERSION} in $EXT"
  echo
  echo "  In Chrome, open chrome://extensions and click ↻ on Bill Split (or restart Chrome)."
else
  echo "✓ Bill Split $VERSION downloaded to $EXT"
  echo
  echo "  One-time setup in Chrome:"
  echo "    1. Open chrome://extensions"
  echo "    2. Turn on Developer mode (top right)"
  echo "    3. Click Load unpacked and choose: $EXT"
  echo "       (in the folder picker, press ⌘⇧G and paste the path; it's on your clipboard)"
  echo
  echo "  To update later, run this command again."
  printf %s "$EXT" | pbcopy 2>/dev/null || true
fi

#!/bin/sh
# Install or update the Bill Split Chrome extension from GitHub Releases (macOS and Linux).
#
#   curl -fsSL https://raw.githubusercontent.com/SansCaar/billsplit/main/tools/install-extension.sh | sh
#
# Windows: use tools/install-extension.ps1 instead (see the README).
#
# Downloads the latest release into ~/Bill Split Extension. Chrome doesn't let scripts install
# extensions from outside the Web Store, so the first time you load that folder yourself
# ("Load unpacked"); after that, rerun this script and click reload on the extension in Chrome.
#
# Plain POSIX sh, so it also runs when piped to bash or zsh. Needs curl and one of unzip, bsdtar
# or python3. Set GITHUB_TOKEN (or be logged in with `gh`) to avoid GitHub's anonymous rate limit.
# Run it as a file to pick a release (install-extension.sh ext-v0.2.0) or a local zip (--zip file.zip).
set -eu

REPO="SansCaar/billsplit"
EXT="$HOME/Bill Split Extension"
STAGE="$HOME/.billsplit-extension-download"
PS_CMD="irm https://raw.githubusercontent.com/SansCaar/billsplit/main/tools/install-extension.ps1 | iex"

fail() { printf '✗ %s\n' "$1" >&2; exit 1; }

case "$(uname -s)" in
  Darwin) OS=mac ;;
  Linux)
    if grep -qsi microsoft /proc/version; then
      fail "This is WSL. Chrome runs on Windows, so install from PowerShell instead:
    $PS_CMD"
    fi
    OS=linux ;;
  MINGW*|MSYS*|CYGWIN*) fail "On Windows, run this in PowerShell instead:
    $PS_CMD" ;;
  *) fail "Unsupported system: $(uname -s). Download the zip from https://github.com/$REPO/releases and load it in Chrome." ;;
esac

command -v curl >/dev/null 2>&1 || fail "curl is missing. Install it (e.g. sudo apt install curl) and run this again."

TMP=$(mktemp -d)
cleanup() { rm -rf "$TMP" "$STAGE"; }
trap cleanup EXIT
trap 'exit 130' INT TERM

TOKEN=${GITHUB_TOKEN:-$(gh auth token 2>/dev/null || true)}
gh_api() {
  if [ -n "$TOKEN" ]; then
    curl -fsSL -H "Authorization: Bearer $TOKEN" -H "X-GitHub-Api-Version: 2022-11-28" "$@"
  else
    curl -fsSL -H "X-GitHub-Api-Version: 2022-11-28" "$@"
  fi
}
# First "key": "string" value in a JSON file (good enough for manifest.json and the release JSON).
json_str() { sed -n "s/.*\"$1\": *\"\([^\"]*\)\".*/\1/p" "$2" 2>/dev/null | head -n 1; }

INSTALLED=$(json_str version "$EXT/manifest.json")

# 1. Download
if [ "${1:-}" = "--zip" ]; then
  [ -f "${2:-}" ] || fail "Usage: install-extension.sh --zip billsplit-extension-x.y.z.zip"
  cp "$2" "$TMP/ext.zip"
else
  if [ -n "${1:-}" ]; then URL="https://api.github.com/repos/$REPO/releases/tags/$1"
  else URL="https://api.github.com/repos/$REPO/releases/latest"; fi
  gh_api "$URL" -o "$TMP/release.json" || fail "Couldn't reach the release on GitHub. Check your connection and try again."
  TAG=$(json_str tag_name "$TMP/release.json")
  ASSET=$(grep -o "\"browser_download_url\": *\"[^\"]*/billsplit-extension-[^\"/]*\.zip\"" "$TMP/release.json" \
    | head -n 1 | sed 's/.*"\(http[^"]*\)"$/\1/')
  [ -n "$ASSET" ] || fail "Release $TAG has no billsplit-extension zip"
  printf '› Downloading Bill Split %s…\n' "$TAG"
  curl -fsSL "$ASSET" -o "$TMP/ext.zip" || fail "The download failed. Try again in a minute."
fi

# 2. Unpack next to the installed copy, check it, then swap it in (keeps the same folder path,
#    so Chrome keeps the extension and its settings)
rm -rf "$STAGE"; mkdir -p "$STAGE"
if command -v unzip >/dev/null 2>&1; then unzip -q "$TMP/ext.zip" -d "$STAGE"
elif command -v bsdtar >/dev/null 2>&1; then bsdtar -xf "$TMP/ext.zip" -C "$STAGE"
elif command -v python3 >/dev/null 2>&1; then python3 -m zipfile -e "$TMP/ext.zip" "$STAGE"
else fail "Need unzip to unpack the download. Install it (e.g. sudo apt install unzip) and run this again."
fi
[ -f "$STAGE/manifest.json" ] || fail "The download has no manifest.json"
rm -rf "$EXT"
mv "$STAGE" "$EXT"
VERSION=$(json_str version "$EXT/manifest.json")

# 3. Open Chrome's extensions page and tell the user what to click
CHROME=""
if [ "$OS" = linux ]; then
  for c in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1; then CHROME=$c; break; fi
  done
fi
open_chrome() {
  if [ "$OS" = mac ]; then
    open -Ra "Google Chrome" 2>/dev/null && open -a "Google Chrome" "chrome://extensions" 2>/dev/null
  else
    [ -n "$CHROME" ] && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] || return 1
    nohup "$CHROME" "chrome://extensions" >/dev/null 2>&1 &
  fi
}
show_folder() {
  if [ "$OS" = mac ]; then open -R "$EXT" 2>/dev/null
  elif [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && command -v xdg-open >/dev/null 2>&1; then
    nohup xdg-open "$EXT" >/dev/null 2>&1 &
  else return 1
  fi
}
copy_path() {
  if [ "$OS" = mac ]; then printf %s "$EXT" | pbcopy
  elif [ -n "${WAYLAND_DISPLAY:-}" ] && command -v wl-copy >/dev/null 2>&1; then printf %s "$EXT" | wl-copy
  elif command -v xclip >/dev/null 2>&1; then printf %s "$EXT" | xclip -selection clipboard
  elif command -v xsel >/dev/null 2>&1; then printf %s "$EXT" | xsel -b
  else return 1
  fi
}
# Wait for Enter so the user can read the steps first. Reads the terminal, not stdin, because with
# `curl | sh` stdin is this script. Returns straight away if there is no terminal.
wait_enter() {
  ( : </dev/tty ) 2>/dev/null || return 0  # subshell: in dash a failed redirect on : is fatal
  printf '\n  Press Enter to open Chrome… '
  read -r _ </dev/tty || true
}

# Has Chrome already loaded this folder? Chrome records unpacked extensions' folders in each
# profile's preferences file, so a plain text search answers it without touching Chrome.
loaded_in_chrome() {
  if [ "$OS" = mac ]; then set -- "$HOME/Library/Application Support/Google/Chrome"
  else set -- "$HOME/.config/google-chrome" "$HOME/.config/chromium" "$HOME/snap/chromium/common/chromium"
  fi
  for dir in "$@"; do
    [ -d "$dir" ] || continue
    find "$dir" -maxdepth 2 \( -name Preferences -o -name "Secure Preferences" \) -type f \
      -exec grep -qsF "\"$EXT\"" {} \; -print 2>/dev/null | grep -q . && return 0
  done
  return 1
}

if [ "$INSTALLED" = "$VERSION" ]; then echo "✓ Bill Split $VERSION is up to date in $EXT"
elif [ -n "$INSTALLED" ]; then echo "✓ Updated Bill Split $INSTALLED → $VERSION in $EXT"
else echo "✓ Bill Split $VERSION downloaded to $EXT"; fi
echo

if [ "$OS" = mac ]; then FM="A Finder window"; GOTO="press ⌘⇧G, paste (the path is on your clipboard)"
else FM="A file manager window"; GOTO="press Ctrl+L, paste the path"
fi

if loaded_in_chrome; then
  echo "  Bill Split is already in Chrome. In chrome://extensions, click ↻ on it to use the new version."
  wait_enter
  open_chrome || true
else
  echo "  Now add it to Chrome (one time only):"
  echo "    1. Open chrome://extensions and turn on Developer mode (switch at the top right)."
  echo "    2. $FM shows the 'Bill Split Extension' folder. Drag it onto the Chrome page."
  echo "       Or click Load unpacked, $GOTO and press Enter."
  echo "    3. Bill Split appears in the list. Pin it from the puzzle-piece menu if you like."
  echo
  echo "  Folder: $EXT"
  echo "  To update later, run this command again."
  copy_path 2>/dev/null || true
  wait_enter
  show_folder || true
  open_chrome || echo "  Couldn't open Chrome. Open chrome://extensions in Chrome yourself."
fi

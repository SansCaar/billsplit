#!/bin/zsh
# Install or update the Bill Split Chrome extension (macOS) from GitHub Releases.
#
#   curl -fsSL https://raw.githubusercontent.com/SansCaar/billsplit/main/tools/install-extension.sh | zsh
#
# While the repo is private, the script authenticates with $GITHUB_TOKEN or `gh auth token`, and the
# script itself has to be fetched with a token too (see README). Needs only curl and macOS built-ins.
#
# Options (when run as a file): a release tag such as ext-v0.2.0, or --zip <file> to install a local zip.
# The extension always lives in ~/.billsplit/extension, so Chrome keeps the same ID and settings across
# updates. First run: Chrome's folder picker opens and the script types the path in (needs Accessibility
# permission for the terminal; otherwise paste the path yourself). Later runs reload it in place.
# Chrome must allow it: View > Developer > "Allow JavaScript from Apple Events".
set -euo pipefail

REPO="SansCaar/billsplit"
EXT="$HOME/.billsplit/extension"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

TOKEN=${GITHUB_TOKEN:-$(gh auth token 2>/dev/null || true)}
AUTH=(); [[ -n "$TOKEN" ]] && AUTH=(-H "Authorization: Bearer $TOKEN")
gh_api() { curl -fsSL "${AUTH[@]}" -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }
manifest_version() { plutil -extract version raw -o - "$1" 2>/dev/null || true; }

# 1. Get the zip
if [[ "${1:-}" == "--zip" ]]; then
  cp "$2" "$TMP/ext.zip"
else
  WANT=${1:-}
  gh_api "https://api.github.com/repos/$REPO/releases?per_page=50" -o "$TMP/releases.json" || {
    echo "✗ Couldn't list releases for $REPO. While the repo is private, run 'gh auth login' or set GITHUB_TOKEN."
    exit 1
  }
  # Newest non-draft, non-prerelease ext-v* release (or the requested tag) and its zip asset.
  read -r TAG ASSET <<<"$(osascript -l JavaScript - "$TMP/releases.json" "$WANT" <<'JS'
function run(argv) {
  const rs = JSON.parse($.NSString.stringWithContentsOfFileEncodingError(argv[0], 4, null).js);
  const r = rs.find(r => argv[1] ? r.tag_name === argv[1] : (!r.draft && !r.prerelease && r.tag_name.startsWith("ext-v")));
  const a = r && r.assets.find(a => /^billsplit-extension-.*\.zip$/.test(a.name));
  return r && a ? r.tag_name + " " + a.url : "";
}
JS
)"
  [[ -n "${ASSET:-}" ]] || { echo "✗ No ext-v* release with a billsplit-extension zip in $REPO"; exit 1; }
  INSTALLED=$(manifest_version "$EXT/manifest.json")
  echo "› Release $TAG (installed: ${INSTALLED:-none})"
  gh_api -H "Accept: application/octet-stream" "$ASSET" -o "$TMP/ext.zip"
fi

# 2. Unpack into its own folder, check it, then swap it into place
mkdir "$TMP/unpacked"
unzip -q "$TMP/ext.zip" -d "$TMP/unpacked"
[[ -f "$TMP/unpacked/manifest.json" ]] || { echo "✗ Zip has no manifest.json at its root"; exit 1; }
mkdir -p "$EXT"
rsync -a --delete "$TMP/unpacked/" "$EXT/"
VERSION=$(manifest_version "$EXT/manifest.json")
echo "  unpacked $VERSION → $EXT"

# 3. Load into Chrome. Runs JS on chrome://extensions, which has the chrome.developerPrivate API.
ext_js() {
  osascript - "$1" <<'AS'
on run argv
  tell application "Google Chrome"
    if (count of windows) = 0 then make new window
    set t to make new tab at end of tabs of front window with properties {URL:"chrome://extensions"}
    delay 1.5
    execute t javascript ("window.__r=undefined;(async()=>{try{window.__r=String(await (" & (item 1 of argv) & "))}catch(e){window.__r='ERR '+e.message}})()")
    repeat 40 times
      set r to execute t javascript "window.__r===undefined?'__wait':window.__r"
      if r is not "__wait" then exit repeat
      delay 0.25
    end repeat
    close t
    return r
  end tell
end run
AS
}

echo "› Loading into Chrome…"
# Turn on Developer mode; if this folder is already loaded, reload it and return its ID.
ID=$(ext_js "(async()=>{
  await chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true});
  const l = await chrome.developerPrivate.getExtensionsInfo({includeDisabled:true});
  const e = l.find(x => x.location==='UNPACKED' && (x.prettifiedPath||'').replace(/^~/, '$HOME').replace(/\/\$/, '')==='$EXT');
  if (!e) return '';
  await chrome.developerPrivate.reload(e.id, {failQuietly:true});
  return e.id;
})()") || ID="ERR osascript failed"

if [[ "$ID" == ERR* ]]; then
  echo "✗ $ID"
  echo "  Turn on Chrome > View > Developer > Allow JavaScript from Apple Events, then rerun."
  exit 1
elif [[ -n "$ID" ]]; then
  echo "✓ Bill Split $VERSION reloaded ($ID)"
  exit 0
fi

# First install: open Chrome's "Load unpacked" folder picker and type the path into it.
echo "  First install: opening Chrome's folder picker…"
printf %s "$EXT" | pbcopy
osascript <<'AS' >/dev/null 2>&1 &
tell application "Google Chrome"
  activate
  set t to make new tab at end of tabs of front window with properties {URL:"chrome://extensions"}
  delay 1.5
  execute t javascript "chrome.developerPrivate.loadUnpacked({failQuietly:false})"
end tell
AS
sleep 3.5
if osascript - "$EXT" <<'AS' >/dev/null 2>&1; then
on run argv
  tell application "System Events"
    keystroke "g" using {command down, shift down}
    delay 0.8
    keystroke (item 1 of argv)
    delay 0.6
    key code 36
    delay 0.8
    key code 36
  end tell
end run
AS
  echo "✓ Bill Split $VERSION loaded from $EXT. Check that it shows up in chrome://extensions."
else
  echo "! I couldn't type into the picker (your terminal needs Accessibility permission)."
  echo "  In the picker, press ⌘⇧G, paste (the path is on your clipboard), then press Enter twice:"
  echo "  $EXT"
fi

#!/bin/zsh
# Usage: chrome.sh open <url>          -> prints tab id (new tab in front window)
#        chrome.sh js <tabId> <file.js> -> runs JS file in that tab, prints result
#        chrome.sh nav <tabId> <url>
#        chrome.sh url <tabId>
set -e
cmd=$1
case $cmd in
  open) osascript -e "tell application \"Google Chrome\" to tell front window to set t to make new tab with properties {URL:\"$2\"}" -e "tell application \"Google Chrome\" to get id of active tab of front window" ;;
  js) osascript - "$2" "$3" <<'AS'
on run argv
  set tid to (item 1 of argv)
  set src to read POSIX file (item 2 of argv) as «class utf8»
  tell application "Google Chrome"
    repeat with w in windows
      repeat with t in tabs of w
        if ((id of t) as text) is tid then return execute t javascript src
      end repeat
    end repeat
  end tell
  return "TAB_NOT_FOUND"
end run
AS
  ;;
  nav) osascript -e "tell application \"Google Chrome\" to repeat with w in windows
    repeat with t in tabs of w
      if ((id of t) as text) is \"$2\" then set URL of t to \"$3\"
    end repeat
  end repeat" ;;
  url) osascript -e "tell application \"Google Chrome\" to repeat with w in windows
    repeat with t in tabs of w
      if ((id of t) as text) is \"$2\" then return {URL of t, title of t, loading of t}
    end repeat
  end repeat" ;;
esac

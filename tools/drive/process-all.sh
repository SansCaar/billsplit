#!/bin/zsh
# Drives the real extension in the user's Chrome over every order (except SKIP). Read-only on walmart.com.
cd "$(dirname $0)/../.."
T=$(cat /tmp/bs_tab); SKIP=$(cat proof/raw/skip-order.txt 2>/dev/null); OUT=proof/raw/process-all.jsonl; : > $OUT
EXT=chrome-extension://abiacnimlphaapcphombefakacgklakj
exttabs() { osascript -e 'tell application "Google Chrome"
set out to ""
repeat with w in windows
repeat with t in tabs of w
if (URL of t) starts with "'$EXT'" then set out to out & (id of t) & " "
end repeat
end repeat
return out
end tell'; }
js() { printf '%s' "$2" > /tmp/drv.js; tools/chrome.sh js $1 /tmp/drv.js 2>/dev/null; }
closetab() { osascript -e 'tell application "Google Chrome"
repeat with w in windows
repeat with t in tabs of w
if ((id of t) as text) is "'$1'" then close t
end repeat
end repeat
end tell' 2>/dev/null; }
i=0
for id in $(cat proof/raw/order-ids.txt); do
  [ "$id" = "$SKIP" ] && continue
  i=$((i+1)); short="…${id: -4}"
  tools/chrome.sh nav $T "https://www.walmart.com/orders/$id"
  ok=""; for s in $(seq 1 20); do sleep 1; [ "$(js $T 'String(!!document.getElementById("billsplit-process-btn"))')" = "true" ] && ok=1 && break; done
  [ -z "$ok" ] && { echo "{\"order\":\"$short\",\"error\":\"no button\"}" | tee -a $OUT; continue; }
  sleep 1
  before=" $(exttabs) "
  js $T 'document.getElementById("billsplit-process-btn").click(); "c"' >/dev/null
  P=""; for s in $(seq 1 20); do sleep 1; for t in $(exttabs); do [[ "$before" != *" $t "* ]] && P=$t; done; [ -n "$P" ] && break; done
  [ -z "$P" ] && { echo "{\"order\":\"$short\",\"error\":\"no processing tab\"}" | tee -a $OUT; continue; }
  ready=""; for s in $(seq 1 20); do sleep 1; r=$(js $P '(function(){if(document.querySelector("[data-testid=item-card]")||document.querySelector("[data-testid=review]"))return "ready";var e=document.querySelector(".bs-error");return e?"ERR "+e.innerText:"wait"})()'); [[ "$r" = ready ]] && ready=1 && break; [[ "$r" = ERR* ]] && break; done
  [ -z "$ready" ] && { echo "{\"order\":\"$short\",\"error\":\"not ready: $r\"}" | tee -a $OUT; closetab $P; continue; }
  meta=$(js $P 'JSON.stringify({meta:document.querySelector("[data-testid=order-meta]").innerText.replace(/#\d{11}(\d{4})/,"#…$1").replace(/•••• \d{4}/,"•••• ####"), warnings:(document.querySelector("[data-testid=warnings]")||{}).innerText||null})')
  a=$(js $P "$(sed "s/__PAYER__/$i/" tools/drive/assign.js)")
  sleep 1.2
  rv=$(js $P "$(sed "s/__PAYER__/$i/" tools/drive/review.js)")
  sleep 0.5
  js $P '(function(){var b=document.querySelector("[data-testid=submit]");if(!b||b.disabled)return "no";b.click();return "sent"})()' >/dev/null
  d=""; for s in $(seq 1 15); do sleep 1; d=$(js $P '(function(){var x=document.querySelector("[data-testid=done]");if(x)return "done";return "wait"})()'); [ "$d" = done ] && break; done
  echo "{\"n\":$i,\"order\":\"$short\",\"id\":\"$id\",\"meta\":$meta,\"assign\":$a,\"review\":$rv,\"sent\":\"$d\"}" >> $OUT
  echo "$i $short items=$(echo $a | python3 -c 'import json,sys;print(json.load(sys.stdin).get("items"))') sent=$d"
  closetab $P
done
echo FINISHED

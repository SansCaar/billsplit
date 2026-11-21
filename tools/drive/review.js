// Runs on the Review screen: set payer, read totals, check they add up.
(function(){
  var payerIdx = __PAYER__;
  var r = document.querySelector("[data-testid=review]");
  if (!r) return JSON.stringify({error:"not on review: "+(document.querySelector(".bs-progress-label")||{}).innerText});
  var p = document.querySelector("[data-testid=payer]");
  var opt = p.options[1 + (payerIdx % (p.options.length - 1))];
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(p, opt.value);
  p.dispatchEvent(new Event("change", { bubbles: true }));
  var cents = function(t){ var m = t.match(/-?\$([\d,]+\.\d\d)/); return m ? Math.round(parseFloat(m[1].replace(/,/g,""))*100) * (t.trim().startsWith("-")?-1:1) : 0; };
  var totals = [].slice.call(document.querySelectorAll(".bs-total-amt")).map(function(e){return cents(e.innerText)});
  var rem = document.querySelector(".bs-remainder"); var remC = rem ? cents(rem.innerText) : 0;
  var sub = r.querySelector(".bs-review-sub").innerText; var tm = sub.match(/total (-?\$[\d,]+\.\d\d)/);
  return JSON.stringify({ head: r.querySelector("h2").innerText, payer: opt.text, members: totals.length, sum: totals.reduce(function(a,b){return a+b},0), remainder: remC, total: tm ? cents(tm[1]) : null, submitEnabled: !document.querySelector("[data-testid=submit]").disabled });
})()

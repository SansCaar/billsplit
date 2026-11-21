// Runs in the extension's Processing tab. Assigns every item with a varied pattern, rotates the payer.
(function(){
  var payerIdx = __PAYER__;
  function k(x){ window.dispatchEvent(new KeyboardEvent("keydown",{key:x})); }
  var sel = document.querySelector("[data-testid=group]");
  var grp = [].slice.call(sel.options).filter(function(o){return o.text==="Appartment B"})[0];
  if (!grp) return JSON.stringify({error:"group missing"});
  if (sel.value !== grp.value) return JSON.stringify({error:"wrong group selected: "+sel.options[sel.selectedIndex].text});
  if (document.querySelector("[data-testid=already-processed]")) return JSON.stringify({error:"already processed"});
  var lbl = document.querySelector(".bs-progress-label").innerText; // "0/N assigned"
  var n = parseInt(lbl.split("/")[1], 10);
  var patterns = [["1","2"],["a"],["s"],["3"],["4","5"],["6"],["2","3","4"]];
  for (var i = 0; i < n; i++) { patterns[i % patterns.length].forEach(k); k("Enter"); }
  return JSON.stringify({ok:true, items:n});
})()

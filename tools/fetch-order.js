// Run inside a walmart.com tab. Synchronous XHR so AppleScript gets the result.
(() => {
  const id = "__ID__";
  const x = new XMLHttpRequest();
  x.open("GET", "/orders/" + id, false);
  x.send();
  const m = x.responseText.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return JSON.stringify({ error: "no next data", status: x.status, len: x.responseText.length });
  return JSON.stringify(JSON.parse(m[1]).props.pageProps.initialData);
})()

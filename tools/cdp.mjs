// Minimal CDP client for the user's real Chrome (chrome://inspect remote debugging).
import fs from "node:fs";
import os from "node:os";
import WebSocket from "ws";
export function wsUrl() {
  const f = `${os.homedir()}/Library/Application Support/Google/Chrome/DevToolsActivePort`;
  const [port, path] = fs.readFileSync(f, "utf8").trim().split("\n");
  return `ws://127.0.0.1:${port}${path}`;
}
export async function connect() {
  const ws = new WebSocket(wsUrl(), { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.on("message", (m) => {
    const msg = JSON.parse(m.toString());
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); }
    else listeners.forEach((l) => l(msg));
  });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  return { ws, send, on: (l) => listeners.push(l), close: () => ws.close() };
}

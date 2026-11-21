import { connect } from "./cdp.mjs";
const c = await connect();
const { targetInfos } = await c.send("Target.getTargets");
console.log(targetInfos.filter(t=>t.type==="page").map(t => `${t.browserContextId} ${t.type} ${t.url.slice(0,80)}`).join("\n"));
const ctx = await c.send("Target.getBrowserContexts");
console.log("contexts", ctx);
c.close();

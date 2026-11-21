/**
 * The floating "Split this order" button on walmart.com, with an entrance meant to be noticed:
 * once the page has settled it springs up from below, and as it lands a burst of sparks and little $ coins
 * flies out, two sonar rings spread, the receipt wiggles and a shine sweeps across. Afterwards it hops every
 * few seconds, three times, then sits still. Reduced-motion users get a plain fade.
 * Everything is scoped under the button's id so Walmart's styles and ours don't touch.
 */
export const BTN_ID = "billsplit-process-btn";
const STYLE_ID = "billsplit-process-style";
export const BTN_LABEL = "Split this order";
/** Wait for Walmart's page to settle so the entrance isn't lost in its own loading jank. */
const START_DELAY_MS = 450;
/** When the button lands (ms after the entrance starts): the burst and rings fire then. */
const LAND = 520;

const COLOURS = ["#f2c14e", "#7fd1ae", "#d98a5f", "#f7faf5", "#4fb08a"];

/** A ring of particles thrown up and out of the button, with a slight downward drift (gravity) at the end. */
function particles(): string {
  const out: string[] = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    // Mostly upward and sideways: the button sits in the bottom-right corner.
    const angle = Math.PI * (0.92 + (1.16 * i) / (n - 1)) + (i % 2 ? 0.08 : -0.08);
    const dist = 78 + ((i * 37) % 60);
    const x = Math.round(Math.cos(angle) * dist * 1.35);
    const y = Math.round(Math.sin(angle) * dist);
    const delay = LAND + ((i * 23) % 90);
    const coin = i % 4 === 1;
    const spin = (i % 2 ? 1 : -1) * (160 + ((i * 53) % 200));
    const style = `--x:${x}px;--y:${y}px;--r:${spin}deg;animation-delay:${delay}ms`;
    if (coin) out.push(`<b class="bs-coin" style="${style}">$</b>`);
    else {
      const size = 5 + ((i * 7) % 6);
      out.push(`<i class="${i % 3 === 0 ? "bs-star" : ""}" style="${style};width:${size}px;height:${size}px;background:${COLOURS[i % COLOURS.length]}"></i>`);
    }
  }
  return out.join("");
}

const B = `#${BTN_ID}`;
const GO = `#${BTN_ID}.bs-go`;
const CSS = `
${B}{all:initial;box-sizing:border-box;position:fixed;right:22px;bottom:22px;z-index:2147483647;display:inline-flex;align-items:center;gap:9px;
  padding:14px 22px 14px 18px;border-radius:999px;cursor:pointer;color:#f7faf5;font:700 15px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.01em;
  background:linear-gradient(135deg,#2f7a5f 0%,#245b47 55%,#1b4536 100%);
  box-shadow:0 14px 32px -12px rgba(27,69,54,.75),inset 0 1px 0 rgba(255,255,255,.18);
  transform-origin:50% 100%;isolation:isolate;-webkit-tap-highlight-color:transparent;opacity:0;
  transition:translate .18s ease,scale .12s ease,box-shadow .18s ease}
${GO}{opacity:1;animation:bs-in .9s cubic-bezier(.2,1.45,.4,1) both,bs-hop 6.5s 3.4s ease-in-out 3,bs-glow 6.5s 3.4s ease-out 3}
${B}:hover{translate:0 -3px;box-shadow:0 20px 38px -14px rgba(27,69,54,.85),inset 0 1px 0 rgba(255,255,255,.22)}
${B}:active{scale:.96}
${B}:focus-visible{outline:3px solid #f2c14e;outline-offset:3px}
${B}[disabled]{cursor:progress;opacity:.88}
${B}[disabled] .bs-ico{animation:bs-spin 1s linear infinite!important}
${B} .bs-ico{display:inline-block;font-size:18px;transform-origin:50% 80%}
${GO} .bs-ico{animation:bs-wiggle-in .75s ${LAND + 80}ms ease-in-out both,bs-wiggle 6.5s 3.4s ease-in-out 3}
${B} .bs-label{position:relative;z-index:1}
/* shine */
${B}::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:2;
  background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.55) 47%,rgba(255,255,255,.15) 54%,transparent 68%) no-repeat;
  background-size:260% 100%;background-position:160% 0}
${GO}::after{animation:bs-shine .9s ${LAND + 150}ms ease-out both,bs-shine-loop 6.5s 3.4s ease-out 3}
/* sonar rings */
${B} .bs-ring{position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:-1;border:2px solid #4fb08a;opacity:0}
${GO} .bs-ring{animation:bs-ring 1.1s ${LAND}ms ease-out forwards,bs-ring-loop 6.5s 3.4s ease-out 3}
${GO} .bs-ring+.bs-ring{border-color:#f2c14e;animation:bs-ring 1.3s ${LAND + 200}ms ease-out forwards}
/* burst */
${B} .bs-burst{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none;z-index:-1}
${B} .bs-burst>*{position:absolute;left:0;top:0;opacity:0}
${B} .bs-burst i{border-radius:50%;box-shadow:0 0 6px currentColor}
${B} .bs-burst i.bs-star{border-radius:2px;clip-path:polygon(50% 0,63% 37%,100% 50%,63% 63%,50% 100%,37% 63%,0 50%,37% 37%);transform-origin:center}
${B} .bs-coin{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font:800 11px/1 system-ui,sans-serif;color:#7a5410;
  background:radial-gradient(circle at 35% 30%,#ffe9a8,#f2c14e 55%,#c8932a);box-shadow:0 2px 6px rgba(0,0,0,.25),inset 0 -1px 0 rgba(0,0,0,.15)}
${GO} .bs-burst>*{animation:bs-pop 1.05s cubic-bezier(.12,.75,.3,1) both}
@keyframes bs-in{
  0%{opacity:0;transform:translateY(130px) scale(.35) rotate(-10deg);filter:blur(6px)}
  58%{opacity:1;transform:translateY(-16px) scale(1.13) rotate(2deg);filter:blur(0)}
  74%{transform:translateY(5px) scale(1.06,.93) rotate(-1deg)}
  88%{transform:translateY(-3px) scale(.99,1.02)}
  100%{opacity:1;transform:none;filter:none}}
@keyframes bs-hop{0%,100%{transform:none}4%{transform:translateY(2px) scale(1.07,.9)}9%{transform:translateY(-18px) scale(.96,1.06) rotate(-2deg)}14%{transform:translateY(0) scale(1.05,.94)}18%{transform:translateY(-4px)}22%{transform:none}}
@keyframes bs-glow{0%,9%{box-shadow:0 14px 32px -12px rgba(27,69,54,.75),0 0 0 0 rgba(79,176,138,.55)}26%,100%{box-shadow:0 14px 32px -12px rgba(27,69,54,.75),0 0 0 18px rgba(79,176,138,0)}}
@keyframes bs-wiggle-in{0%,100%{transform:none}15%,55%{transform:rotate(-18deg) scale(1.25)}35%,75%{transform:rotate(15deg) scale(1.25)}}
@keyframes bs-wiggle{0%,100%{transform:none}2%,10%{transform:rotate(-16deg) scale(1.15)}5%,13%{transform:rotate(14deg) scale(1.15)}16%{transform:none}}
@keyframes bs-shine{to{background-position:-60% 0}}
@keyframes bs-shine-loop{0%,8%{background-position:160% 0}22%,100%{background-position:-60% 0}}
@keyframes bs-ring{0%{opacity:.95;transform:scale(1)}100%{opacity:0;transform:scale(1.3,2.1)}}
@keyframes bs-ring-loop{0%,9%{opacity:0;transform:scale(1)}10%{opacity:.8;transform:scale(1)}28%,100%{opacity:0;transform:scale(1.25,1.9)}}
@keyframes bs-pop{
  0%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(0)}
  12%{opacity:1}
  70%{opacity:1;transform:translate(calc(var(--x) - 50%),calc(var(--y) - 50%)) scale(1) rotate(calc(var(--r) * .8))}
  100%{opacity:0;transform:translate(calc(var(--x) - 50%),calc(var(--y) - 50% + 26px)) scale(.6) rotate(var(--r))}}
@keyframes bs-spin{to{transform:rotate(360deg)}}
@keyframes bs-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){
  ${GO},${GO} .bs-ico,${GO}::after{animation:bs-fade .3s both!important}
  ${B} .bs-ring,${B} .bs-burst{display:none}}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  (document.head ?? document.documentElement).appendChild(s);
}

export function createSplitButton(onClick: (b: HTMLButtonElement) => void): HTMLButtonElement {
  ensureStyle();
  const b = document.createElement("button");
  b.id = BTN_ID;
  b.type = "button";
  b.innerHTML =
    `<span class="bs-ring" aria-hidden="true"></span><span class="bs-ring" aria-hidden="true"></span>` +
    `<span class="bs-burst" aria-hidden="true">${particles()}</span>` +
    `<span class="bs-ico" aria-hidden="true">🧾</span><span class="bs-label">${BTN_LABEL}</span>`;
  b.addEventListener("click", () => onClick(b));
  setTimeout(() => b.classList.add("bs-go"), START_DELAY_MS);
  return b;
}

export function setButtonBusy(b: HTMLButtonElement, busy: boolean) {
  b.disabled = busy;
  const label = b.querySelector(".bs-label");
  if (label) label.textContent = busy ? "Reading order…" : BTN_LABEL;
}

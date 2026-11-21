"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@billsplit/assign-ui";

/** The scroll-driven "how it works" story: steps scroll past while a pinned mockup changes with them. */
const STEPS = [
  { kicker: "Step 1", title: "Open any Walmart order", text: "On walmart.com, open an order and click Split this order. Bill Split reads every item, opens every collapsed section, and checks the total to the cent." },
  { kicker: "Step 2", title: "Tap who had what", text: "One item at a time. Tap the people who shared it, then Next. Everyone and Same as last make a 40-item order take about a minute." },
  { kicker: "Step 3", title: "Tax and fees split themselves", text: "Tax follows what each person bought. Delivery and tip split evenly. Leftover cents stay visible, never quietly added to someone." },
  { kicker: "Step 4", title: "Everyone sees the same balances", text: "The order lands in your group as one expense. Balances update instantly on every phone, with every change on record." },
  { kicker: "Step 5", title: "Settle up in a tap", text: "Paid back on Venmo or in cash? Mark it received. Bill Split suggests the fewest payments to get everyone to zero." },
];

const PEOPLE = ["You", "Ayush", "Nishant"];
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function Story() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [p, setP] = useState(0);

  useEffect(() => {
    const el = root.current!;
    const steps = [...el.querySelectorAll<HTMLElement>("[data-step]")];
    let raf = 0;
    const update = () => {
      const line = innerHeight * 0.55;
      let a = 0, prog = 0;
      steps.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        if (r.top <= line) { a = i; prog = clamp((line - r.top) / r.height); }
      });
      setActive(a);
      setP(prog);
      el.style.setProperty("--lp-story", String((a + prog) / steps.length));
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => { removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const state = (i: number) => (i === active ? "on" : i < active ? "past" : "next");
  const local = (i: number) => (i < active ? 1 : i > active ? 0 : p);

  return (
    <section className="lp-story" id="how" ref={root}>
      <div className="lp-story-head">
        <span className="lp-kicker">How it works</span>
        <h2>From a Walmart receipt to settled up</h2>
      </div>
      <div className="lp-story-grid">
        <ol className="lp-steps">
          <span className="lp-rail" aria-hidden="true"><span /></span>
          {STEPS.map((s, i) => (
            <li key={s.title} data-step className={`lp-step ${state(i)}`}>
              <span className="lp-step-num">{i + 1}</span>
              <span className="lp-kicker">{s.kicker}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="lp-stage-wrap">
          <div className={`lp-device ${active >= 3 ? "phone" : "browser"}`}>
            <div className="lp-device-bar" aria-hidden="true">
              <span className="lp-dots"><i /><i /><i /></span>
              <span className="lp-url">{active === 0 ? "walmart.com/orders/…0002" : active < 3 ? "Bill Split · Walmart order" : "bsplit.vercel.app"}</span>
            </div>
            <div className="lp-screen" aria-hidden="true">
              <SceneWalmart s={state(0)} p={local(0)} />
              <SceneAssign s={state(1)} p={local(1)} />
              <SceneReview s={state(2)} p={local(2)} />
              <SceneBalances s={state(3)} p={local(3)} />
              <SceneSettle s={state(4)} p={local(4)} />
            </div>
          </div>
          <div className="lp-caption" aria-live="polite">
            <span className="lp-caption-dots" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i <= active ? "on" : ""} />)}</span>
            <h3>{STEPS[active]!.title}</h3>
            <p>{STEPS[active]!.text}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SceneWalmart({ s, p }: { s: string; p: number }) {
  const items = [["Bananas, 2 lb", "$1.48"], ["Whole milk, gallon", "$4.28"], ["Paper towels, 6 rolls", "$12.97"], ["Cheddar, 8 oz", "$2.97"], ["Eggs, 18 count", "$4.12"]];
  const clicked = p > 0.62;
  return (
    <div className={`lp-scene lp-walmart ${s}`}>
      <div className="lp-wm-head"><b>Order details</b><span>Delivered Nov 18 · 20 items</span></div>
      {items.map(([n, v], i) => (
        <div key={n} className="lp-wm-row" style={{ transitionDelay: `${i * 60}ms` }}><span className="lp-thumb" />{n}<b>{v}</b></div>
      ))}
      <div className="lp-wm-total"><span>Total</span><b>$97.21</b></div>
      <div className={`lp-split-btn ${clicked ? "pressed" : ""}`}>🧾 {clicked ? "Reading order…" : "Split this order"}</div>
      <div className="lp-cursor" style={{ transform: `translate(${(1 - ease(p * 1.5)) * -160}px, ${(1 - ease(p * 1.5)) * -120}px) scale(${clicked ? 0.85 : 1})` }} />
    </div>
  );
}

function SceneAssign({ s, p }: { s: string; p: number }) {
  const picked = [p > 0.22, p > 0.45, p > 0.68];
  const done = Math.round(4 + p * 9);
  return (
    <div className={`lp-scene lp-assign ${s}`}>
      <div className="lp-progress"><span>{done}/15 assigned</span><i><b style={{ width: `${(done / 15) * 100}%` }} /></i></div>
      <div className="lp-cards">
        <div className="lp-card back2" />
        <div className="lp-card back1" />
        <div className="lp-card front">
          <span className="lp-eyebrow">Item 5 of 15</span>
          <div className="lp-item"><span className="lp-thumb big">🍌</span><div><b>Bananas, 2 lb</b><span>Qty 1</span><em>$1.48</em></div></div>
          <div className="lp-who"><b>Who shares this?</b><span>Everyone · Same as last</span></div>
          {PEOPLE.map((name, i) => (
            <div key={name} className={`lp-person ${picked[i] ? "on" : ""}`}>
              <span className="lp-box">{picked[i] ? "✓" : ""}</span>
              <Avatar name={name} index={i} size={26} />
              <span className="lp-grow">{name}</span>
              <b>{picked[i] ? money(Math.round(148 / picked.filter(Boolean).length)) : ""}</b>
            </div>
          ))}
          <div className={`lp-next ${p > 0.85 ? "go" : ""}`}>Next →</div>
        </div>
      </div>
    </div>
  );
}

function SceneReview({ s, p }: { s: string; p: number }) {
  const totals = [[3241, 212], [2896, 188], [3112, 202]];
  const t = ease(p * 1.4);
  return (
    <div className={`lp-scene lp-review ${s}`}>
      <span className="lp-eyebrow">Review</span>
      <h4>All assigned: review &amp; send</h4>
      <div className="lp-rules">
        <span className={p > 0.2 ? "on" : ""}>Tax <b>by what each bought</b></span>
        <span className={p > 0.4 ? "on" : ""}>Fees &amp; tip <b>equally</b></span>
      </div>
      <div className="lp-totals">
        {PEOPLE.map((name, i) => (
          <div key={name} className="lp-total" style={{ transitionDelay: `${i * 80}ms` }}>
            <Avatar name={name} index={i} size={30} />
            <span>{name}</span>
            <b>{money(Math.round(totals[i]![0]! * t))}</b>
            <em>tax {money(Math.round(totals[i]![1]! * t))}</em>
          </div>
        ))}
      </div>
      <div className="lp-check"><span>✓</span> Matches Walmart&apos;s total to the cent</div>
      <div className={`lp-send ${p > 0.8 ? "go" : ""}`}>Send to group</div>
    </div>
  );
}

function SceneBalances({ s, p }: { s: string; p: number }) {
  const rows: [string, number, number][] = [["Ayush", 1410, 1], ["Nishant", 417, 2]];
  return (
    <div className={`lp-scene lp-balances ${s}`}>
      <span className="lp-eyebrow">Apartment 4B</span>
      <div className="lp-owed"><span>You&apos;re owed</span><b>{money(Math.round(1827 * ease(p * 1.3)))}</b></div>
      {rows.map(([n, c, i], k) => (
        <div key={n} className={`lp-bal-row ${p > 0.25 + k * 0.2 ? "in" : ""}`}><Avatar name={n} index={i} size={26} /><span className="lp-grow"><b>{n}</b> owes you</span><em>{money(c)}</em></div>
      ))}
      <div className={`lp-feed ${p > 0.65 ? "in" : ""}`}>
        <span className="lp-eyebrow">Activity</span>
        <div><Avatar name="You" index={0} size={20} /><span className="lp-grow">You split a <b>Walmart order</b></span><b>$97.21</b></div>
      </div>
    </div>
  );
}

function SceneSettle({ s, p }: { s: string; p: number }) {
  const paid = p > 0.5;
  return (
    <div className={`lp-scene lp-settle ${s}`}>
      <span className="lp-eyebrow">Settle up</span>
      <div className={`lp-pay ${paid ? "paid" : ""}`}>
        <div className="lp-pay-flow"><Avatar name="Ayush" index={1} size={34} /><span>→</span><Avatar name="You" index={0} size={34} /></div>
        <div><span><b>Ayush</b> pays you</span><strong>$14.10</strong></div>
        <div className="lp-mark">{paid ? "✓ Received" : "Mark received"}</div>
      </div>
      <div className={`lp-settled ${p > 0.72 ? "in" : ""}`}>
        <span className="lp-burst" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ transform: `rotate(${i * 36}deg) translateY(-34px)` }} />)}</span>
        <b>Ayush is settled up</b>
        <span>Balances updated for everyone.</span>
      </div>
    </div>
  );
}

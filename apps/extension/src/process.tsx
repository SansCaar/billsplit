import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SPLIT_RULES, fmtMoney, splitOrder, type Assignments, type ParsedOrder, type SplitRules } from "@billsplit/core";
import { AssignFlow } from "@billsplit/assign-ui";
import "@billsplit/assign-ui/styles.css";
import "./process.css";

interface MeGroup { id: string; name: string; me?: string; defaults: { splitRules: SplitRules }; members: { id: string; name: string }[] }
interface Me { user: { name: string }; groups: MeGroup[] }
interface Preview { exists: boolean; expenseId?: string; payerId?: string; rules?: SplitRules; assignments?: Assignments; changes?: { type: string; text: string }[] }

declare const __APP_URL__: string;
/** Set at build time: the hosted app by default, `pnpm build:local` for localhost. */
const DEFAULT_APP = __APP_URL__;

async function getAppUrl(): Promise<string> {
  const { appUrl } = await chrome.storage.sync.get("appUrl");
  return (appUrl as string) || DEFAULT_APP;
}

/** Move assignments to another group by matching people by name (case-insensitive). Items whose people don't all exist there are dropped. */
function carryAssignments(a: Assignments, from: MeGroup, to: MeGroup): { assignments: Assignments; kept: number; dropped: number } {
  const byName = new Map(to.members.map((m) => [m.name.trim().toLowerCase(), m.id]));
  const map = new Map(from.members.map((m) => [m.id, byName.get(m.name.trim().toLowerCase())]));
  const out: Assignments = {};
  let kept = 0, dropped = 0;
  for (const [key, split] of Object.entries(a)) {
    if (!split.shares.length) continue;
    if (split.shares.every((x) => map.get(x.memberId))) { out[key] = { ...split, shares: split.shares.map((x) => ({ ...x, memberId: map.get(x.memberId)! })) }; kept++; }
    else dropped++;
  }
  return { assignments: out, kept, dropped };
}

async function call<T>(app: string, path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(app + path, { method, credentials: "include", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error("signin"), { signin: true });
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j as T;
}

function App() {
  const orderNumber = new URLSearchParams(location.search).get("order") ?? "";
  const [app, setApp] = useState(DEFAULT_APP);
  const [order, setOrder] = useState<ParsedOrder | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [needSignin, setNeedSignin] = useState(false);
  const [groupId, setGroupId] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ title: string; text: string; retry: boolean } | null>(null);
  const [signinTab, setSigninTab] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ url: string; created: boolean; myShare: number | null } | null>(null);
  /** Latest assignments from the flow, so switching groups can carry them over instead of starting again. */
  const latest = useRef<Assignments>({});
  const [carried, setCarried] = useState<{ assignments: Assignments; kept: number; dropped: number; from: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setFailure(null);
    const appUrl = await getAppUrl();
    setApp(appUrl);
    const stored = (await chrome.storage.local.get(`order:${orderNumber}`))[`order:${orderNumber}`] as ParsedOrder | undefined;
    if (!stored) return setFailure({ title: "Open the order again", text: "This tab lost the order it was splitting. Go back to the order on walmart.com and click “Split this order” again.", retry: false });
    setOrder(stored);
    try {
      const m = await call<Me>(appUrl, "/api/me");
      setMe(m);
      setNeedSignin(false);
      const { lastGroupId } = await chrome.storage.local.get("lastGroupId");
      const g = m.groups.find((x) => x.id === lastGroupId) ?? m.groups[0];
      if (g) setGroupId(g.id);
    } catch (e) {
      if ((e as { signin?: boolean }).signin) setNeedSignin(true);
      else setFailure({ title: "Can't reach Bill Split", text: `Bill Split at ${appUrl.replace(/^https?:\/\//, "")} didn't answer (${(e as Error).message}). Check your connection and try again.`, retry: true });
    }
  }, [orderNumber]);

  useEffect(() => { load(); }, [load]);
  // Re-check when the user comes back from the sign-in (or create-a-group) tab, and poll while they're over there.
  const blocked = needSignin || (!!me && !me.groups.length);
  useEffect(() => {
    if (!blocked) return;
    const f = () => load();
    window.addEventListener("focus", f);
    const t = waiting ? setInterval(f, 2500) : undefined;
    return () => { window.removeEventListener("focus", f); if (t) clearInterval(t); };
  }, [blocked, waiting, load]);
  // Signed in: close the sign-in tab we opened and bring this one back to the front.
  useEffect(() => {
    if (!me || signinTab === null) return;
    chrome.tabs.remove(signinTab).catch(() => {});
    chrome.tabs.getCurrent((t) => { if (t?.id) chrome.tabs.update(t.id, { active: true }); });
    setSigninTab(null);
    setWaiting(false);
  }, [me, signinTab]);
  const openTab = async (path: string) => {
    const t = await chrome.tabs.create({ url: app + path });
    setSigninTab(t.id ?? null);
    setWaiting(true);
  };

  useEffect(() => {
    if (!groupId || !order) return;
    setPreview(null);
    chrome.storage.local.set({ lastGroupId: groupId });
    call<Preview>(app, `/api/groups/${groupId}/orders/preview`, "POST", { order }).then(setPreview).catch((e) => setFailure({ title: "Couldn't load this group", text: (e as Error).message, retry: true }));
  }, [groupId, order, app]);

  const group = me?.groups.find((g) => g.id === groupId);
  const switchGroup = (id: string) => {
    const to = me?.groups.find((g) => g.id === id);
    if (group && to && Object.values(latest.current).some((x) => x.shares.length)) setCarried({ ...carryAssignments(latest.current, group, to), from: group.name });
    else setCarried(null);
    latest.current = {};
    setError(null);
    setGroupId(id);
  };

  if (failure)
    return (
      <Shell order={order ?? undefined}>
        <Gate icon="!" tone="warn" title={failure.title}>
          <p>{failure.text}</p>
          {failure.retry && <button className="bs-btn primary block" onClick={load}>Try again</button>}
          {failure.retry && <Settings app={app} onSave={load} />}
        </Gate>
      </Shell>
    );
  if (error && !order) return <Shell><Gate icon="!" tone="warn" title="Something went wrong"><p>{error}</p><button className="bs-btn primary block" onClick={load}>Try again</button></Gate></Shell>;
  if (!order) return <Shell><Gate spinner title="Loading the order…" /></Shell>;
  if (needSignin)
    return (
      <Shell order={order}>
        <Gate icon="b" title="Connect to Bill Split" testId="signin">
          <p>Sign in to send this order to your group. You only need to do this once.</p>
          <OrderChip order={order} />
          {waiting ? (
            <div className="gate-wait" role="status">
              <span className="spinner" aria-hidden="true" />
              <div><b>Waiting for you to sign in…</b><span>Finish in the tab that just opened. This page continues by itself.</span></div>
            </div>
          ) : (
            <button className="bs-btn primary block" data-testid="open-signin" onClick={() => openTab("/signin?callbackUrl=/connected")}><GoogleMark /> Sign in with Google</button>
          )}
          {waiting && (
            <div className="gate-links">
              <button className="bs-link" onClick={() => openTab("/signin?callbackUrl=/connected")}>Open sign-in again</button>
              <button className="bs-link" onClick={load}>I've signed in</button>
            </div>
          )}
          <Settings app={app} onSave={load} />
        </Gate>
      </Shell>
    );
  if (!me) return <Shell order={order}><Gate spinner title="Connecting to Bill Split…" /></Shell>;
  if (!me.groups.length)
    return (
      <Shell order={order}>
        <Gate icon="+" title="Create a group first">
          <p>Orders are split inside a group. Make one for your household, then come back to this tab.</p>
          <OrderChip order={order} />
          {waiting ? (
            <div className="gate-wait" role="status"><span className="spinner" aria-hidden="true" /><div><b>Waiting for your new group…</b><span>Create it in the other tab. This page continues by itself.</span></div></div>
          ) : (
            <button className="bs-btn primary block" onClick={() => openTab("/?new=1")}>Create a group</button>
          )}
          <div className="gate-links"><span className="mute">Signed in as {me.user.name}</span></div>
        </Gate>
      </Shell>
    );
  if (done)
    return (
      <Shell order={order}>
        <div data-testid="done">
          <Gate icon="✓" tone="ok" title={`${done.created ? "Order sent to" : "Order updated in"} ${group?.name ?? "your group"}`}>
            {done.myShare !== null && <div className="done-share"><span>Your share</span><b>{fmtMoney(done.myShare)}</b></div>}
            <p>Everyone in the group can see it now and fix their own items.</p>
            <a className="bs-btn primary block" href={app + done.url} target="_blank" rel="noreferrer" data-testid="open-expense">Open in Bill Split</a>
            <button className="bs-btn ghost block" style={{ marginTop: 10 }} onClick={() => window.close()} data-testid="close-tab">Close this tab</button>
          </Gate>
        </div>
      </Shell>
    );

  const useCarried = !!carried && !preview?.exists;
  const carriedNotice = useCarried && carried ? (
    <div className="bs-notice" data-testid="carried-over">
      <b>Switched to {group?.name}.</b> Kept {carried.kept} assignment{carried.kept === 1 ? "" : "s"} from {carried.from} by matching people by name
      {carried.dropped ? <>; {carried.dropped} item{carried.dropped === 1 ? "" : "s"} had someone who isn't in {group?.name} and need{carried.dropped === 1 ? "s" : ""} assigning again.</> : "."}
    </div>
  ) : null;
  const notice = preview?.exists ? (
    <div className="bs-notice" data-testid="already-processed">
      <b>This order was already processed in {group?.name}.</b> Existing assignments are filled in — sending again will update it.
      {preview.changes?.length ? (
        <>
          <div style={{ marginTop: 6 }}>Changes since last time:</div>
          <ul>{preview.changes.map((c, i) => <li key={i}>{c.text}</li>)}</ul>
        </>
      ) : <div style={{ marginTop: 6 }}>Walmart shows no changes since last time.</div>}
    </div>
  ) : null;

  return (
    <Shell order={order}>
      <div className="toolbar">
        <label>Splitting into
          <select value={groupId} onChange={(e) => switchGroup(e.target.value)} data-testid="group">
            {me.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <span className="mute">Signed in as {me.user.name}</span>
      </div>
      {order.warnings.length > 0 && (
        <div className="bs-notice" data-testid="warnings"><b>Please double-check:</b><ul>{order.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
      )}
      {group && preview && (
        <AssignFlow
          key={`${groupId}:${preview.exists}`}
          order={order}
          members={group.members}
          initialAssignments={useCarried ? carried!.assignments : preview.assignments ?? {}}
          resumeAtFirstUnassigned={useCarried}
          onAssignmentsChange={(a) => { latest.current = a; }}
          rules={preview.rules ?? group.defaults.splitRules ?? DEFAULT_SPLIT_RULES}
          payerId={preview.payerId ?? group.me ?? null}
          notice={notice ?? carriedNotice}
          submitLabel={preview.exists ? "Update in group" : "Send to group"}
          busy={busy}
          error={error}
          onSubmit={async ({ assignments, rules, payerId }) => {
            setBusy(true);
            setError(null);
            try {
              const r = await call<{ url: string; created: boolean }>(app, `/api/groups/${groupId}/orders`, "POST", { order, assignments, rules, payerId });
              const mine = group.me ? splitOrder(order, assignments, rules).members[group.me]?.total ?? 0 : null;
              setDone({ ...r, myShare: mine });
            } catch (e) {
              const msg = (e as { signin?: boolean }).signin ? "you were signed out" : (e as Error).message;
              setError(`Couldn't send this order: ${msg}. Your assignments are still here, so nothing is lost. Press “${preview.exists ? "Update in group" : "Send to group"}” to try again.`);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ order, children }: { order?: ParsedOrder; children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="head">
        <div className="logo">Bill Split</div>
        {order && (
          <div className="order-meta" data-testid="order-meta">
            Walmart #{order.orderNumber}
            {order.placedAt ? ` · ${new Date(order.placedAt).toLocaleDateString()}` : ""}
            {order.total !== null ? ` · ${fmtMoney(order.total)}` : ""}
            {order.paymentCards[0]?.last4 ? ` · •••• ${order.paymentCards[0].last4}` : ""}
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}

function Settings({ app, onSave }: { app: string; onSave: () => void }) {
  const [v, setV] = useState(app);
  return (
    <details className="gate-settings">
      <summary>Connection settings</summary>
      <label>Bill Split address
        <span className="gate-settings-row">
          <input value={v} onChange={(e) => setV(e.target.value)} spellCheck={false} />
          <button className="bs-btn ghost" onClick={async () => { await chrome.storage.sync.set({ appUrl: v.replace(/\/$/, "") }); onSave(); }}>Save</button>
        </span>
      </label>
    </details>
  );
}

function Gate({ icon, title, tone, spinner, testId, children }: { icon?: string; title: string; tone?: "ok" | "warn"; spinner?: boolean; testId?: string; children?: React.ReactNode }) {
  return (
    <section className="gate" data-testid={testId}>
      {spinner ? <span className="spinner big" aria-hidden="true" /> : <div className={`gate-icon ${tone ?? ""}`}>{icon}</div>}
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function OrderChip({ order }: { order: ParsedOrder }) {
  const n = order.items.filter((i) => i.amount > 0).length;
  return (
    <div className="order-chip">
      <span className="order-chip-mark">W</span>
      <div><b>Walmart order #…{order.orderNumber.slice(-4)}</b><span>{n} item{n === 1 ? "" : "s"}{order.total !== null ? ` · ${fmtMoney(order.total)}` : ""}</span></div>
    </div>
  );
}

function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style={{ background: "#fff", borderRadius: 4, padding: 1, marginRight: 8 }}><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;
}

createRoot(document.getElementById("root")!).render(<App />);

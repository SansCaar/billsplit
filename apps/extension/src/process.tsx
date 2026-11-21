import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SPLIT_RULES, fmtMoney, type Assignments, type ParsedOrder, type SplitRules } from "@billsplit/core";
import { AssignFlow } from "@billsplit/assign-ui";
import "@billsplit/assign-ui/styles.css";
import "./process.css";

interface MeGroup { id: string; name: string; me?: string; defaults: { splitRules: SplitRules }; members: { id: string; name: string }[] }
interface Me { user: { name: string }; groups: MeGroup[] }
interface Preview { exists: boolean; expenseId?: string; payerId?: string; rules?: SplitRules; assignments?: Assignments; changes?: { type: string; text: string }[] }

const DEFAULT_APP = "http://localhost:3000";

async function getAppUrl(): Promise<string> {
  const { appUrl } = await chrome.storage.sync.get("appUrl");
  return (appUrl as string) || DEFAULT_APP;
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
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ url: string; created: boolean } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const appUrl = await getAppUrl();
    setApp(appUrl);
    const stored = (await chrome.storage.local.get(`order:${orderNumber}`))[`order:${orderNumber}`] as ParsedOrder | undefined;
    if (!stored) return setError("Order data not found. Go back to the Walmart order page and click “Split this order” again.");
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
      else setError(`Can't reach Bill Split at ${appUrl}: ${(e as Error).message}`);
    }
  }, [orderNumber]);

  useEffect(() => { load(); }, [load]);
  // Re-check sign-in when the user comes back from the sign-in tab.
  useEffect(() => {
    const f = () => needSignin && load();
    window.addEventListener("focus", f);
    return () => window.removeEventListener("focus", f);
  }, [needSignin, load]);

  useEffect(() => {
    if (!groupId || !order) return;
    setPreview(null);
    chrome.storage.local.set({ lastGroupId: groupId });
    call<Preview>(app, `/api/groups/${groupId}/orders/preview`, "POST", { order }).then(setPreview).catch((e) => setError((e as Error).message));
  }, [groupId, order, app]);

  const group = me?.groups.find((g) => g.id === groupId);

  if (error) return <Shell><div className="bs-error">{error}</div></Shell>;
  if (!order) return <Shell><p>Loading…</p></Shell>;
  if (needSignin)
    return (
      <Shell order={order}>
        <div className="panel">
          <h2>Sign in to Bill Split</h2>
          <p>Sign in once, then come back to this tab.</p>
          <button className="bs-btn primary" onClick={() => chrome.tabs.create({ url: `${app}/signin?callbackUrl=/` })}>Open sign-in</button>
          <button className="bs-btn ghost" style={{ marginLeft: 8 }} onClick={load}>I've signed in</button>
          <Settings app={app} onSave={load} />
        </div>
      </Shell>
    );
  if (!me) return <Shell order={order}><p>Connecting to Bill Split…</p></Shell>;
  if (!me.groups.length)
    return <Shell order={order}><div className="panel"><p>You're not in any group yet.</p><a className="bs-btn primary" href={app} target="_blank" rel="noreferrer">Create a group</a></div></Shell>;
  if (done)
    return (
      <Shell order={order}>
        <div className="panel done" data-testid="done">
          <div className="confetti">🎉</div>
          <h2>{done.created ? "Order sent to" : "Order updated in"} {group?.name}</h2>
          <p>Everyone in the group can now see it and fix their own items.</p>
          <a className="bs-btn primary" href={app + done.url} target="_blank" rel="noreferrer" data-testid="open-expense">Open in Bill Split</a>
        </div>
      </Shell>
    );

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
        <label>Group
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} data-testid="group">
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
          initialAssignments={preview.assignments ?? {}}
          rules={preview.rules ?? group.defaults.splitRules ?? DEFAULT_SPLIT_RULES}
          payerId={preview.payerId ?? group.me ?? null}
          notice={notice}
          submitLabel={preview.exists ? "Update in group" : "Send to group"}
          busy={busy}
          error={error}
          onSubmit={async ({ assignments, rules, payerId }) => {
            setBusy(true);
            try {
              const r = await call<{ url: string; created: boolean }>(app, `/api/groups/${groupId}/orders`, "POST", { order, assignments, rules, payerId });
              setDone(r);
            } catch (e) {
              alert((e as Error).message);
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
    <details style={{ marginTop: 16 }}>
      <summary className="mute">Bill Split address</summary>
      <input value={v} onChange={(e) => setV(e.target.value)} style={{ width: 320 }} />
      <button className="bs-btn ghost" onClick={async () => { await chrome.storage.sync.set({ appUrl: v.replace(/\/$/, "") }); onSave(); }}>Save</button>
    </details>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

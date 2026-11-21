import { Avatar } from "@billsplit/assign-ui";

/** Shared layout for every signed-out / joining screen: a green brand panel beside (or above, on phones) a card. */
export function AuthShell({ hero, children }: { hero: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="auth-hero-in">
          <div className="auth-brand"><span className="brand-mark">b</span>Bill Split</div>
          {hero}
        </div>
      </section>
      <section className="auth-main">
        <div className="auth-card">{children}</div>
      </section>
    </main>
  );
}

export function HeroIntro() {
  return (
    <>
      <h1 className="auth-title">Split shared bills, item by item.</h1>
      <p className="auth-lead">Walmart orders and everyday costs for your household, with balances everyone can trust.</p>
      <ul className="auth-points">
        <li><Icon d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6" /><div><b>Walmart orders, line by line</b><span>Open an order, tap who had what. Tax and fees split themselves.</span></div></li>
        <li><Icon d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7zm14 0-3 7a3 3 0 0 0 6 0l-3-7z" /><div><b>Always know who owes whom</b><span>Balances update the moment anything changes.</span></div></li>
        <li><Icon d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /><div><b>Every change on record</b><span>See who edited what, and when.</span></div></li>
      </ul>
      <Receipt />
    </>
  );
}

export function HeroInvite({ groupName, members }: { groupName: string; members: string[] }) {
  return (
    <>
      <span className="auth-eyebrow">You're invited</span>
      <h1 className="auth-title">Join {groupName}</h1>
      <p className="auth-lead">Split groceries, bills and Walmart orders together. Everyone sees the same balances.</p>
      {members.length > 0 && (
        <div className="auth-members">
          <span className="avatars">{members.slice(0, 6).map((m, i) => <Avatar key={i} name={m} index={i} size={34} />)}</span>
          <span>{members.length === 1 ? members[0] : `${members.slice(0, 2).join(", ")}${members.length > 2 ? ` and ${members.length - 2} more` : ""}`}</span>
        </div>
      )}
    </>
  );
}

function Receipt() {
  const rows: [string, string, string[]][] = [["Bananas, 2 lb", "$1.48", ["Ayush", "Nishant"]], ["Whole milk, gallon", "$4.28", ["You"]], ["Paper towels, 6 rolls", "$12.97", ["You", "Ayush", "Nishant"]]];
  return (
    <div className="auth-receipt" aria-hidden="true">
      <div className="auth-receipt-head"><span>Walmart order</span><span>3 items</span></div>
      {rows.map(([name, price, who]) => (
        <div key={name} className="auth-receipt-row">
          <span className="grow">{name}</span>
          <span className="avatars">{who.map((w) => <Avatar key={w} name={w} index={["You", "Ayush", "Nishant"].indexOf(w)} size={20} />)}</span>
          <span className="amt">{price}</span>
        </div>
      ))}
      <div className="auth-receipt-foot"><span>Your share</span><b>$8.60</b></div>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return <span className="auth-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg></span>;
}

import {
  ArrowRight,
  BookOpenText,
  Landmark,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export function GettingStarted() {
  return (
    <>
      <section className="welcome-panel">
        <div className="welcome-content">
          <p className="eyebrow">A clean start</p>
          <h2>Your tracker is ready for your own structure.</h2>
          <p>
            Begin with the accounts you actually use. Add current balances,
            then record monthly movements. Summary and history will grow from
            your entries without filling anything on your behalf.
          </p>
          <span className="privacy-note">
            <ShieldCheck size={15} />
            No sample accounts or default amounts were created
          </span>
        </div>
      </section>

      <div className="section-heading">
        <h2>Set up in three simple steps</h2>
        <p>The same familiar tracker flow, prepared for online access.</p>
      </div>

      <section className="setup-grid">
        <article className="setup-card">
          <span className="setup-card-number">01</span>
          <h3>Add your accounts</h3>
          <p>
            Organise cash, banks, investments, RSUs, assets and liabilities in
            the categories you already understand.
          </p>
          <footer><Landmark size={15} /> Start with one account</footer>
        </article>
        <article className="setup-card">
          <span className="setup-card-number">02</span>
          <h3>Enter opening values</h3>
          <p>
            Record only the current values you know. Every amount stays empty
            until you choose to enter it.
          </p>
          <footer><BookOpenText size={15} /> Build your first snapshot</footer>
        </article>
        <article className="setup-card">
          <span className="setup-card-number">03</span>
          <h3>Watch the picture form</h3>
          <p>
            Monthly summaries and a focused net-worth trend will appear as your
            real data becomes available.
          </p>
          <footer><Sparkles size={15} /> Your data, clearly connected <ArrowRight size={14} /></footer>
        </article>
      </section>

      <div className="section-heading">
        <h2>Your overview</h2>
        <p>These cards remain blank until your first account is added.</p>
      </div>
      <section className="empty-data-row" aria-label="Empty financial overview">
        {["Total assets", "Liabilities", "Net worth"].map((label) => (
          <article className="empty-data-card" key={label}>
            <header>
              <span>{label}</span>
              <span>Not added</span>
            </header>
            <div className="empty-value" />
          </article>
        ))}
      </section>
    </>
  );
}

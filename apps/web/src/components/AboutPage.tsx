import { BadgeCheck, Bot, Crosshair, HeartHandshake, ShieldCheck } from "lucide-react";

export function AboutPage() {
  return (
    <>
      <section className="about-page" aria-labelledby="about-title">
        <header className="about-hero">
          <span>About</span>
          <h1 id="about-title">Solane Run</h1>
          <p>
            A premium, independent freight service built for New Eden haulers who want fast quoting,
            clear route intel, and fewer surprises before creating a courier contract.
          </p>
        </header>

        <div className="about-grid">
          <article className="about-card about-card-primary">
            <i aria-hidden="true"><ShieldCheck size={22} /></i>
            <div>
              <span>Freight Desk</span>
              <h2>Built around operational clarity</h2>
              <p>
                The calculator focuses on practical courier decisions: service area, cargo size,
                collateral limits, route safety, and contract reward.
              </p>
            </div>
          </article>

          <article className="about-card">
            <i aria-hidden="true"><Crosshair size={21} /></i>
            <div>
              <span>Route Intel</span>
              <h2>Useful beyond Solane Run</h2>
              <p>
                Crossroads, popular corridors, corruption states, and gate activity are surfaced as
                a free cockpit for transport pilots.
              </p>
            </div>
          </article>

          <article className="about-card">
            <i aria-hidden="true"><Bot size={21} /></i>
            <div>
              <span>Solane API</span>
              <h2>Private engine, public signals</h2>
              <p>
                Pricing and risk rules stay private, while the site and Discord updates expose clean,
                readable signals for clients.
              </p>
            </div>
          </article>

          <article className="about-card">
            <i aria-hidden="true"><HeartHandshake size={21} /></i>
            <div>
              <span>Independent</span>
              <h2>Solo-driven by design</h2>
              <p>
                Solane Run is maintained as a focused personal project, with quality and sustainable
                operations taking priority over scale.
              </p>
            </div>
          </article>
        </div>

        <aside className="about-note" aria-label="Service status note">
          <BadgeCheck size={17} />
          <span>Beta operations are active. Features may evolve, but the service remains English-only and EVE-focused.</span>
        </aside>
      </section>

      <footer className="site-footer">
        <strong>Solane Run</strong>
        <span>Premium & independant freight shipping service</span>
        <span>{"\u00a9"} 2026 Victor A. All rights reserved.</span>
      </footer>
    </>
  );
}

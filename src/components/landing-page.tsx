import Link from "next/link";
import { DM_Serif_Display } from "next/font/google";

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
});

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* ── Nav Bar ── */}
      <header className="sticky top-0 z-50 border-b border-[#ddd9d0] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <p
              className="cb-display text-[3.1rem] leading-none tracking-[-0.03em] text-[#1c3a28]"
              style={{
                fontFamily: "Baskerville, 'Times New Roman', serif",
                fontWeight: 600,
              }}
            >
              Tally<span className="text-[#c4531a]">.</span>
            </p>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-[#ddd9d0] bg-white px-5 py-2.5 text-sm font-semibold text-[#1c3a28] transition-colors hover:bg-[#ede9e1]"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-[#c4531a] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b04a16]"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="px-6 pb-24 pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.12em] text-[#7a7a70]">
              Simple time tracking for professional teams
            </p>
            <h1 className="mb-6 text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-[#1c3a28] sm:text-5xl md:text-6xl">
              Time tracking your team will actually use
            </h1>
            <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-[#4a4a42]">
              Your team logs hours. You run reports. Profitability is
              clear. No bloat, no learning curve, no 47-tab setup wizard.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center rounded-xl bg-[#c4531a] px-8 text-base font-semibold text-white transition-colors hover:bg-[#b04a16]"
              >
                Get started free
              </Link>
              <a
                href="#features"
                className="inline-flex h-12 items-center rounded-xl border border-[#ddd9d0] bg-white px-8 text-base font-semibold text-[#1c3a28] transition-colors hover:bg-[#ede9e1]"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* ── Problem / Solution Cards ── */}
        <section className="bg-white px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className={`${dmSerif.className} mb-4 text-center text-3xl tracking-[-0.02em] text-[#1c3a28] md:text-4xl`}>
              Time tracking shouldn&rsquo;t be this hard
            </h2>
            <p className="mx-auto mb-16 max-w-2xl text-center text-base leading-relaxed text-[#4a4a42]">
              Most tools have 100 features connected to 100 systems. Your team
              ignores them. Tally does the essentials, and does them well.
            </p>
            <div className="grid gap-8 md:grid-cols-3">
              {/* Card 1 */}
              <div className="rounded-2xl border border-[#ddd9d0] bg-white p-8 shadow-[0_1px_3px_rgba(20,18,12,0.08)]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f7f4ef]">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#1c3a28"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[#1c3a28]">
                  Log hours in seconds
                </h3>
                <p className="text-sm leading-relaxed text-[#4a4a42]">
                  Start a timer or add time manually. Pick a client, pick a
                  workstream, done. Your team spends less time tracking time.
                </p>
              </div>

              {/* Card 2 */}
              <div className="rounded-2xl border border-[#ddd9d0] bg-white p-8 shadow-[0_1px_3px_rgba(20,18,12,0.08)]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f7f4ef]">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#1c3a28"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="18" rx="1" />
                    <rect x="14" y="9" width="7" height="12" rx="1" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[#1c3a28]">
                  Run reports instantly
                </h3>
                <p className="text-sm leading-relaxed text-[#4a4a42]">
                  Filter by client, employee, date range, or workstream. Export
                  to CSV for billing. No pivot tables required.
                </p>
              </div>

              {/* Card 3 */}
              <div className="rounded-2xl border border-[#ddd9d0] bg-white p-8 shadow-[0_1px_3px_rgba(20,18,12,0.08)]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f7f4ef]">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#1c3a28"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-[#1c3a28]">
                  Know your profitability
                </h3>
                <p className="text-sm leading-relaxed text-[#4a4a42]">
                  See revenue vs. cost at a glance. Know which clients and
                  projects are profitable — and which are eating into margins.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Who It's For ── */}
        <section className="bg-[#1c3a28] px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className={`${dmSerif.className} mb-4 text-center text-3xl tracking-[-0.02em] text-white md:text-4xl`}>
              Built for teams who value their time
            </h2>
            <p className="mx-auto mb-16 max-w-2xl text-center text-base leading-relaxed text-[#ede9e1]/80">
              Whether you&rsquo;re billing hourly or tracking profitability on
              flat-fee work, Tally fits how your team already operates.
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#24482f] bg-[#24482f]/50 p-6">
                <h3 className="mb-2 text-lg font-semibold text-white">
                  Accounting Firms
                </h3>
                <p className="text-sm leading-relaxed text-[#ede9e1]/70">
                  Track billable hours across clients and engagements. Run
                  profitability reports your partners actually want to see.
                </p>
              </div>
              <div className="rounded-2xl border border-[#24482f] bg-[#24482f]/50 p-6">
                <h3 className="mb-2 text-lg font-semibold text-white">
                  Professional Services
                </h3>
                <p className="text-sm leading-relaxed text-[#ede9e1]/70">
                  From consulting to advisory, keep every hour accounted for.
                  Bill accurately and know your margins per engagement.
                </p>
              </div>
              <div className="rounded-2xl border border-[#24482f] bg-[#24482f]/50 p-6">
                <h3 className="mb-2 text-lg font-semibold text-white">
                  Agencies
                </h3>
                <p className="text-sm leading-relaxed text-[#ede9e1]/70">
                  Stop guessing which projects are profitable. Track time
                  against clients and catch scope creep before it becomes a
                  problem.
                </p>
              </div>
              <div className="rounded-2xl border border-[#24482f] bg-[#24482f]/50 p-6">
                <h3 className="mb-2 text-lg font-semibold text-white">
                  Freelancers &amp; Advisors
                </h3>
                <p className="text-sm leading-relaxed text-[#ede9e1]/70">
                  Simple enough for a team of one. Log hours, generate reports,
                  and get back to the work that matters.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Key Features ── */}
        <section id="features" className="bg-[#f7f4ef] px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 text-center">
              <h2 className={`${dmSerif.className} text-3xl leading-snug tracking-[-0.02em] text-[#1c3a28] sm:text-4xl md:text-5xl`}>
                Track your time.
                <br />
                Know your margins.
                <br />
                Get paid.
              </h2>
            </div>
            <p className="mx-auto mb-16 max-w-xl text-center text-base leading-relaxed text-[#4a4a42]">
              Lightweight, no-nonsense time tracking that&rsquo;s so easy your
              team will actually use it.
            </p>
            <div className="grid gap-10 md:grid-cols-3">
              <div className="text-center">
                <p
                  className="mb-3 text-5xl font-medium text-[#c4531a]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  01
                </p>
                <h3 className="mb-3 text-xl font-semibold text-[#1c3a28]">
                  Log Hours
                </h3>
                <p className="text-sm leading-relaxed text-[#4a4a42]">
                  Start a live timer or add time after the fact. Assign every
                  entry to a client and workstream so nothing slips through the
                  cracks.
                </p>
              </div>
              <div className="text-center">
                <p
                  className="mb-3 text-5xl font-medium text-[#c4531a]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  02
                </p>
                <h3 className="mb-3 text-xl font-semibold text-[#1c3a28]">
                  Run Reports
                </h3>
                <p className="text-sm leading-relaxed text-[#4a4a42]">
                  Filter by date, client, employee, or workstream. Export clean
                  CSVs for invoicing, payroll, or your own sanity.
                </p>
              </div>
              <div className="text-center">
                <p
                  className="mb-3 text-5xl font-medium text-[#c4531a]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  03
                </p>
                <h3 className="mb-3 text-xl font-semibold text-[#1c3a28]">
                  Track Profitability
                </h3>
                <p className="text-sm leading-relaxed text-[#4a4a42]">
                  See revenue, cost, and profit per client at a glance. Spot
                  unprofitable engagements before they become problems.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Social Proof ── */}
        <section className="bg-white px-6 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#7a7a70]">
              Trusted by teams who value simplicity
            </p>
            <p className="text-base leading-relaxed text-[#4a4a42]">
              Accounting firms, advisors, and professional service teams use
              Tally to track every hour without the overhead of enterprise
              software.
            </p>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="bg-[#1c3a28] px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className={`${dmSerif.className} mb-6 text-3xl tracking-[-0.02em] text-white md:text-4xl`}>
              Start tracking time the simple way
            </h2>
            <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-[#ede9e1]/80">
              Set up your team in minutes. No credit card required. No 30-page
              onboarding guide.
            </p>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center rounded-xl bg-[#c4531a] px-10 text-base font-semibold text-white transition-colors hover:bg-[#b04a16]"
            >
              Get started free
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-[#141412] px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
            <p
              className="text-2xl leading-none tracking-[-0.03em] text-white/80"
              style={{
                fontFamily: "Baskerville, 'Times New Roman', serif",
                fontWeight: 600,
              }}
            >
              Tally<span className="text-[#c4531a]">.</span>
            </p>
            <nav className="flex gap-6 text-sm text-white/50">
              <Link href="/login" className="transition-colors hover:text-white/80">
                Log in
              </Link>
              <Link href="/signup" className="transition-colors hover:text-white/80">
                Sign up
              </Link>
              <a href="#" className="transition-colors hover:text-white/80">
                Privacy
              </a>
              <a href="#" className="transition-colors hover:text-white/80">
                Terms
              </a>
            </nav>
          </div>
          <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-white/30">
            &copy; {new Date().getFullYear()} Tally. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

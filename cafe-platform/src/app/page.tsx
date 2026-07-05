import Link from "next/link";
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  WHATSAPP_URL,
} from "@/lib/brand";
import { LeadForm } from "@/components/marketing/LeadForm";
import { PhoneDemo } from "@/components/marketing/PhoneDemo";

export const metadata = {
  title: `${BRAND_NAME} — QR menu & table ordering for cafes, zero commission`,
  description:
    "Customers scan a QR at the table, order and pay by UPI or cash — no app, no waiter wait, no aggregator commission. Built for independent Indian cafes.",
};

/**
 * Marketing landing (menupe.com-style structure): the front door where a
 * cafe owner discovers the product and leaves a lead. Warm brand palette,
 * hero shows the real product surface in a phone frame.
 */

function Icon({ d, className = "h-6 w-6" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const D = {
  qr: "M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z M6.75 6.75h.008v.008H6.75V6.75Zm0 9.75h.008v.008H6.75v-.008Zm9.75-9.75h.008v.008h-.008V6.75Zm-3 6h.008v.008H13.5v-.008Zm0 6h.008v.008H13.5v-.008Zm6-6h.008v.008h-.008v-.008Zm0 6h.008v.008h-.008v-.008Zm-3-3h.008v.008H16.5v-.008Z",
  toggle: "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25",
  upi: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z",
  printer: "M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659",
  bell: "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0",
  chart: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
  phone: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z",
  whatsapp: "M20.25 12a8.25 8.25 0 0 1-12.06 7.32L4.5 20.25l.977-3.6A8.25 8.25 0 1 1 20.25 12Zm-11-2.5c0 3.176 2.574 5.75 5.75 5.75.55 0 .996-.446.996-.996v-.708a.75.75 0 0 0-.542-.72l-1.5-.43a.75.75 0 0 0-.79.263l-.264.33a4.52 4.52 0 0 1-2.14-2.14l.33-.263a.75.75 0 0 0 .263-.79l-.43-1.5a.75.75 0 0 0-.72-.542h-.708a.996.996 0 0 0-.996.996Z",
} as const;

const FEATURES = [
  { icon: D.qr, title: "QR menu in a day", body: "We set your full menu up and hand you print-ready QR stickers per table." },
  { icon: D.toggle, title: "Sold out in one tap", body: "Flip a dish off from your phone. Customers stop seeing it that second." },
  { icon: D.upi, title: "UPI money comes to you", body: "Payments land in your own account. No middleman, no weekly settlements." },
  { icon: D.printer, title: "Kitchen prints itself", body: "Every order prints a kitchen slip automatically. No shouting, no missed chits." },
  { icon: D.bell, title: "Never miss an order", body: "New orders pop up loud on your dashboard with the table number." },
  { icon: D.chart, title: "Know your day's sales", body: "Today's total, online vs cash, day-over-day reports. No accountant needed." },
] as const;

const STEPS = [
  { n: "1", title: "Talk to us", body: "One call or WhatsApp. Tell us your table count and share your menu — even a photo of it works." },
  { n: "2", title: "We set everything up", body: "Menu built, prices in, QR stickers printed for every table. You approve before going live." },
  { n: "3", title: "Customers scan & order", body: "They order and pay from their seat. You cook, collect, and keep 100% of every bill." },
] as const;

const USE_CASES = ["Cafes", "Quick-service restaurants", "Bakeries & dessert bars", "Food courts"] as const;

export default function LandingPage() {
  return (
    <div className="text-foreground">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6" aria-label="Main">
          <a href="#top" className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-primary">
              <span className="h-3 w-3 rounded-full bg-accent" />
            </span>
            <span className="text-lg font-bold tracking-tight text-primary">{BRAND_NAME}</span>
          </a>
          <div className="hidden items-center gap-6 text-sm font-medium text-foreground/80 md:flex">
            <a href="#how-it-works" className="transition-colors duration-150 hover:text-primary">How it works</a>
            <a href="#features" className="transition-colors duration-150 hover:text-primary">Features</a>
            <a href="#pricing" className="transition-colors duration-150 hover:text-primary">Pricing</a>
            <Link href="/owner/login" className="transition-colors duration-150 hover:text-primary">Owner login</Link>
          </div>
          <a
            href="#contact"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          >
            Get started
          </a>
        </nav>
      </header>

      <main id="top">
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-6 lg:pt-20">
          <div>
            <p className="text-sm font-semibold tracking-wider text-accent uppercase">For independent cafes</p>
            <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight text-foreground sm:text-5xl">
              {BRAND_TAGLINE}
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted">
              Customers scan the QR on their table, order, and pay by UPI or cash — no app to
              download, no waiter to wait for, and no aggregator taking a cut of your money.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#contact"
                className="rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white transition-opacity duration-150 hover:opacity-90"
              >
                Get started free
              </a>
              <Link
                href="/demo-cafe"
                className="rounded-xl border border-primary/30 bg-surface px-6 py-3.5 text-base font-semibold text-primary transition-colors duration-150 hover:bg-primary/5"
              >
                See a live menu
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted">
              0% commission · UPI &amp; cash · Works on any phone, no app
            </p>
          </div>
          <PhoneDemo />
        </section>

        {/* ── Commission math (signature band) ────────────────────────── */}
        <section aria-label="Commission comparison" className="bg-[#2b2016] py-12 text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-sm font-semibold tracking-wider text-accent uppercase">The math your cafe feels</p>
            <div className="mt-6 grid gap-8 sm:grid-cols-2">
              <div className="border-l-4 border-white/20 pl-5">
                <p className="text-sm text-white/60">On a ₹500 order through an aggregator</p>
                <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
                  ₹375<span className="text-lg font-medium text-white/60"> reaches you</span>
                </p>
                <p className="mt-1 text-sm text-white/60">~25% commission, fees and ads eat the rest</p>
              </div>
              <div className="border-l-4 border-accent pl-5">
                <p className="text-sm text-white/60">The same order with {BRAND_NAME}</p>
                <p className="mt-2 text-4xl font-bold tracking-tight text-accent tabular-nums">
                  ₹500<span className="text-lg font-medium text-white/60"> reaches you</span>
                </p>
                <p className="mt-1 text-sm text-white/60">Flat subscription. Your food, your money.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────────── */}
        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Live in three steps</h2>
          <p className="mt-2 max-w-xl text-muted">
            You don&apos;t set anything up alone — our team does the heavy lifting during onboarding.
          </p>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Features ────────────────────────────────────────────────── */}
        <section id="features" className="scroll-mt-20 bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Everything a cafe needs. Nothing it doesn&apos;t.</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-border bg-background p-6">
                  <span className="inline-flex rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Icon d={f.icon} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Use cases ───────────────────────────────────────────────── */}
        <section aria-label="Who it's for" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Built for tables that turn fast</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u) => (
              <div
                key={u}
                className="rounded-2xl border border-primary/15 bg-gradient-to-br from-surface to-background p-6 text-center"
              >
                <p className="text-base font-semibold text-primary">{u}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────────────────── */}
        <section id="pricing" className="scroll-mt-20 bg-primary py-16 text-white">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">Simple pricing. Zero commission. Ever.</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80">
              A one-time setup (sized to your menu and tables) plus a flat monthly subscription.
              No cut of your orders, no hidden fees. We&apos;ll quote it in one call.
            </p>
            <a
              href="#contact"
              className="mt-8 inline-block rounded-xl bg-accent px-8 py-4 text-base font-semibold text-white transition-opacity duration-150 hover:opacity-90"
            >
              Talk to us about pricing
            </a>
          </div>
        </section>

        {/* ── Lead form ───────────────────────────────────────────────── */}
        <section id="contact" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Get your cafe on {BRAND_NAME}</h2>
              <p className="mt-3 max-w-md text-muted">
                Leave your number and we&apos;ll call you back — or reach us straight away:
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-success px-5 py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
                >
                  <Icon d={D.whatsapp} className="h-5 w-5" />
                  WhatsApp us
                </a>
                <a
                  href={`tel:${CONTACT_PHONE_TEL}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-background"
                >
                  <Icon d={D.phone} className="h-5 w-5 text-primary" />
                  {CONTACT_PHONE_DISPLAY}
                </a>
              </div>
            </div>
            <LeadForm />
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="max-w-sm">
            <p className="text-lg font-bold text-primary">{BRAND_NAME}</p>
            <p className="mt-2 text-sm text-muted">
              QR menus and table-side ordering for independent Indian cafes — commission-free,
              UPI-first, and live in days.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <a href="#how-it-works" className="text-muted transition-colors duration-150 hover:text-primary">How it works</a>
            <a href="#features" className="text-muted transition-colors duration-150 hover:text-primary">Features</a>
            <a href="#pricing" className="text-muted transition-colors duration-150 hover:text-primary">Pricing</a>
            <Link href="/demo-cafe" className="text-muted transition-colors duration-150 hover:text-primary">Live demo menu</Link>
            <Link href="/owner/login" className="text-muted transition-colors duration-150 hover:text-primary">Owner login</Link>
            <a href={`tel:${CONTACT_PHONE_TEL}`} className="text-muted transition-colors duration-150 hover:text-primary">
              {CONTACT_PHONE_DISPLAY}
            </a>
          </nav>
        </div>
        <p className="border-t border-border py-4 text-center text-xs text-muted">
          © {new Date().getFullYear()} {BRAND_NAME} · All rights reserved
        </p>
      </footer>
    </div>
  );
}

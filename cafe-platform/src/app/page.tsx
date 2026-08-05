import Link from "next/link";
import {
  BRAND_NAME,
  BRAND_TAGLINE_LINES,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  WHATSAPP_URL,
} from "@/lib/brand";
import { LeadForm } from "@/components/marketing/LeadForm";
import { MenuPhone } from "@/components/marketing/MenuPhone";
import { Reveal } from "@/components/marketing/Reveal";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Icon, ViewfinderCorner, D } from "@/components/marketing/icons";

export const metadata = {
  title: `${BRAND_NAME} — QR menu & table ordering for cafes, zero commission`,
  description:
    "Customers scan a QR at the table, order and pay by UPI or cash — no app, no waiter wait, no aggregator commission. Built for independent Indian cafes.",
};

/**
 * Marketing landing: the front door where a cafe owner discovers the
 * product and leaves a lead. Signature motif borrows the product's own
 * paper trail — receipts, chits, tabular mono figures — rather than
 * generic SaaS card chrome. Warm brand palette + Geist stay locked
 * (DESIGN_SYSTEM.md §1); the redesign lives in type treatment, layout
 * rhythm, structure and restrained one-shot motion instead.
 */

const FEATURES = [
  { icon: D.qr, title: "QR menu in a day", body: "We set your full menu up and hand you print-ready QR stickers per table.", comingSoon: false },
  { icon: D.toggle, title: "Sold out in one tap", body: "Flip a dish off from your phone. Customers stop seeing it that second.", comingSoon: false },
  { icon: D.upi, title: "UPI money comes to you", body: "Payments land in your own account. No middleman, no weekly settlements.", comingSoon: false },
  { icon: D.printer, title: "Kitchen prints itself", body: "Every order prints a kitchen slip automatically. No shouting, no missed chits.", comingSoon: false },
  { icon: D.bell, title: "Never miss an order", body: "New orders pop up loud on your dashboard with the table number.", comingSoon: false },
  { icon: D.chart, title: "Know your day's sales", body: "Today's total, online vs cash, day-over-day reports. No accountant needed.", comingSoon: false },
  { icon: D.trend, title: "Smart upsell prompts", body: "Suggest the add-ons customers actually want, right when they're ordering.", comingSoon: true },
  { icon: D.star, title: "Loyalty points", body: "Regulars earn points on every visit and see them update instantly.", comingSoon: true },
] as const;

const STEPS = [
  { n: "01", title: "Talk to us", body: "One call or WhatsApp. Tell us your table count and share your menu — even a photo of it works." },
  { n: "02", title: "We set everything up", body: "Menu built, prices in, QR stickers printed for every table. You approve before going live." },
  { n: "03", title: "Customers scan & order", body: "They order and pay from their seat. You cook, collect, and keep 100% of every bill." },
] as const;

const STEP_ICONS = [D.phone, D.printer, D.qr] as const;

const USE_CASES = [
  { label: "Cafes", icon: D.cup },
  { label: "Quick-service restaurants", icon: D.bolt },
  { label: "Bakeries & dessert bars", icon: D.cupcake },
  { label: "Food courts", icon: D.cutlery },
] as const;

const WHY_CARDS = [
  { title: "Smoother kitchen ops", body: "Every order prints a kitchen slip the second it lands — no shouting across the counter, no missed chits during the rush." },
  { title: "Zero commission, ever", body: "UPI payments land straight in your own account. Keep 100% of every bill — no aggregator taking a cut." },
] as const;

const AGGREGATOR_LINES = [
  { label: "Order total", value: "₹500" },
  { label: "Commission (~25%)", value: "−₹125" },
] as const;

const ORDERLY_LINES = [
  { label: "Order total", value: "₹500" },
  { label: "Commission", value: "₹0" },
] as const;

/** Hero proof line — claims, not invented metrics. */
const HERO_PROOF = [
  { figure: "0%", label: "commission, ever" },
  { figure: "No app", label: "to download" },
  { figure: "1 day", label: "to go live" },
] as const;

const PLAN_INCLUDES = [
  "Your full menu built and priced for you",
  "Print-ready QR stickers for every table",
  "Owner dashboard, live orders and kitchen slips",
  "UPI paid straight into your own account",
  "Sales reports, day by day",
  "WhatsApp support in English or Hindi",
] as const;

export default function LandingPage() {
  return (
    <div className="text-foreground">
      <SiteHeader />

      <main id="top">
        {/* ── Hero ────────────────────────────────────────────────────────
            The hero's argument is the product itself: the right column is a
            working replica of the customer menu, wearing the site's own
            palette. Visitors are meant to poke at it. ──────────────────── */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1fr_auto] lg:gap-14 lg:pt-20 lg:pb-28">
            <Reveal variant="left">
              <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-primary/40 bg-surface px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
                <ViewfinderCorner className="text-accent" />
                For independent cafes
              </span>
              {/* Three lines on purpose: each is a separate claim, and the
                  break keeps the measure short enough to read as a headline
                  rather than a sentence. */}
              <h1 className="font-display mt-6 text-[2.75rem] leading-[1.06] font-semibold tracking-tight text-foreground sm:text-6xl lg:text-[4rem]">
                {BRAND_TAGLINE_LINES.map((line, i) => (
                  <span
                    key={line}
                    className={`block ${i === BRAND_TAGLINE_LINES.length - 1 ? "text-primary" : ""}`}
                  >
                    {line}
                  </span>
                ))}
              </h1>
              <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted">
                Customers scan the QR on their table, order, and pay by UPI or cash — no app to
                download, no waiter to wait for, and no aggregator taking a cut of your money.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="#contact"
                  className="sheen cursor-pointer rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-primary/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Get started free
                </a>
                <Link
                  href="/demo"
                  className="cursor-pointer rounded-xl border border-primary/30 bg-surface px-6 py-3.5 text-base font-semibold text-primary transition-all duration-150 hover:-translate-y-px hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  See a live menu
                </Link>
              </div>

              <dl className="mt-10 flex flex-wrap items-stretch gap-x-7 gap-y-4 border-t border-dashed border-border pt-6">
                {HERO_PROOF.map((p) => (
                  <div key={p.label}>
                    <dt className="font-mono text-lg font-bold tracking-tight text-primary">{p.figure}</dt>
                    <dd className="mt-0.5 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">{p.label}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal delayMs={120} variant="scale">
              <div className="relative mx-auto w-fit">
                {/* Warm light pooled behind the phone so the artefact sits in
                    the page rather than on it. */}
                <div
                  aria-hidden="true"
                  className="glow-pool pointer-events-none absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(217,119,6,0.22),transparent_70%)]"
                />

                {/* Paper chits pinned to the phone — the product's real
                    artefacts (a scanned table, a settled bill) framing the
                    screen they came from. */}
                <div
                  aria-hidden="true"
                  className="float-slow absolute -top-4 -left-6 z-20 hidden -rotate-6 rounded-sm border border-dashed border-primary/30 bg-surface px-3 py-1.5 font-mono text-[10px] font-semibold tracking-wider text-muted uppercase shadow-sm sm:block"
                >
                  Table 07 · scanned 7:24 pm
                </div>
                <div
                  aria-hidden="true"
                  className="float-slower absolute -right-6 -bottom-5 z-20 hidden rotate-3 rounded-sm border border-dashed border-accent/50 bg-surface px-3 py-2 shadow-sm sm:block"
                >
                  <p className="font-mono text-[9px] font-semibold tracking-[0.14em] text-muted uppercase">
                    Paid by UPI
                  </p>
                  <p className="font-mono text-sm font-bold tracking-tight tabular-nums text-primary">
                    ₹1,240 <span className="text-accent">· ₹0 cut</span>
                  </p>
                </div>

                <div className="scan-sweep">
                  <MenuPhone />
                </div>

                <p className="mt-5 text-center font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
                  The real menu screen — go on, tap it
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Commission math (signature band) ────────────────────────── */}
        <section aria-label="Commission comparison" className="chit-edge-b on-dark bg-[#2b2016] py-24 text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">The math your cafe feels</p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Two receipts. Same ₹500 order.
              </h2>
            </Reveal>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <Reveal delayMs={60} variant="left">
                <div className="h-full rounded-lg border border-dashed border-white/25 bg-white/[0.04] p-6">
                  <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-white/50 uppercase">Receipt · Aggregator app</p>
                  <dl className="mt-4 space-y-2 font-mono text-sm">
                    {AGGREGATOR_LINES.map((l) => (
                      <div key={l.label} className="flex items-baseline justify-between">
                        <dt className="text-white/60">{l.label}</dt>
                        {/* The rule draws itself as the row scrolls in, so the
                            deduction is something you watch happen. */}
                        <dd className="strike-draw tabular-nums text-white/70 decoration-white/30">{l.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-white/25 pt-4">
                    <span className="font-mono text-sm text-white/60">You receive</span>
                    <span className="font-mono text-3xl font-bold tabular-nums">₹375</span>
                  </div>
                </div>
              </Reveal>

              <Reveal delayMs={140} variant="right">
                <div className="relative h-full rounded-lg border border-dashed border-accent/60 bg-white/[0.04] p-6">
                  <span
                    aria-hidden="true"
                    className="stamp absolute -top-3 -right-3 rounded border-2 border-accent bg-[#2b2016] px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-accent uppercase"
                  >
                    100% yours
                  </span>
                  <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">Receipt · {BRAND_NAME}</p>
                  <dl className="mt-4 space-y-2 font-mono text-sm">
                    {ORDERLY_LINES.map((l) => (
                      <div key={l.label} className="flex items-baseline justify-between">
                        <dt className="text-white/60">{l.label}</dt>
                        <dd className="tabular-nums text-white/90">{l.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-accent/40 pt-4">
                    <span className="font-mono text-sm text-white/60">You receive</span>
                    <span className="font-mono text-3xl font-bold text-accent tabular-nums">₹500</span>
                  </div>
                </div>
              </Reveal>
            </div>
            <p className="mt-6 max-w-2xl text-sm text-white/50">
              Flat subscription, paid once a month. Not a cut of every order — your food, your money.
            </p>
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────────── */}
        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-5 lg:items-center lg:gap-8">
            <div className="lg:col-span-3">
              <Reveal>
                <h2 className="font-display text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">Live in three steps</h2>
                <p className="mt-3 max-w-xl text-muted">
                  You don&apos;t set anything up alone — our team does the heavy lifting during onboarding.
                </p>
              </Reveal>

              <ol className="mt-10 grid gap-4 sm:grid-cols-3">
                {STEPS.map((s, i) => (
                  <Reveal key={s.n} delayMs={i * 90}>
                    <li className="group relative h-full overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10">
                      <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-surface text-primary shadow-sm transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-105">
                        <Icon d={STEP_ICONS[i]} className="h-5 w-5" />
                        <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-bold text-white ring-2 ring-surface">
                          {i + 1}
                        </span>
                      </span>
                      <h3 className="mt-3.5 text-base font-semibold text-foreground transition-colors duration-300 group-hover:text-primary">{s.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-accent transition-transform duration-300 ease-out group-hover:scale-x-100" />
                    </li>
                  </Reveal>
                ))}
              </ol>

              <Reveal delayMs={STEPS.length * 90 + 60}>
                <a
                  href="#contact"
                  className="sheen group mt-8 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Talk to us
                  <Icon
                    d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1"
                  />
                </a>
              </Reveal>
            </div>

            <div className="lg:col-span-2">
              <Reveal delayMs={120}>
                <div className="group relative mx-auto max-w-sm lg:max-w-none">
                  <div
                    aria-hidden="true"
                    className="absolute -top-5 -right-4 h-full w-full rotate-2 rounded-[2rem] bg-accent transition-transform duration-500 ease-out group-hover:rotate-3 group-hover:-translate-y-1 sm:-top-7 sm:-right-6"
                  />
                  <div className="relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[1.75rem] border border-primary/20 bg-primary p-7 text-white shadow-xl transition-transform duration-500 ease-out group-hover:-translate-y-1.5 sm:p-8">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold tracking-widest text-white/60 uppercase">Table 05</span>
                      <ViewfinderCorner className="h-4 w-4 text-white/40" />
                    </div>
                    <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-2xl bg-white text-primary shadow-lg transition-transform duration-500 ease-out group-hover:scale-105 sm:h-36 sm:w-36">
                      <Icon d={D.qr} className="h-16 w-16 sm:h-20 sm:w-20" />
                    </div>
                    <div>
                      <p className="font-mono text-[11px] font-semibold tracking-widest text-accent uppercase">Scan · Order · Pay</p>
                      <p className="mt-1 text-sm text-white/70">No app. No waiting for a waiter. Live in a day.</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────── */}
        <section id="features" className="scroll-mt-20 bg-background py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">Features</p>
              <h2 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
                Everything a cafe needs. Nothing it doesn&apos;t.
              </h2>
              <p className="mt-4 text-muted">
                No bloat, no modules you&apos;ll never open — just the tools a small cafe reaches for every single service.
              </p>
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delayMs={(i % 4) * 70} variant="scale">
                  <div className="group relative h-full rounded-2xl border border-border bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                    {f.comingSoon && (
                      <span className="stamp absolute -top-2.5 -right-2.5 rounded border border-primary/30 bg-primary px-2 py-1 font-mono text-[9px] font-bold tracking-[0.1em] text-white uppercase shadow-sm">
                        Coming soon
                      </span>
                    )}
                    <span className="inline-flex rounded-xl border border-primary/15 bg-surface p-2.5 text-primary shadow-sm transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105">
                      <Icon d={f.icon} />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why choose ──────────────────────────────────────────────── */}
        <section aria-label={`Why choose ${BRAND_NAME}`} className="bg-secondary/[0.06] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-10">
            <div>
              <Reveal>
                <h2 className="font-display text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
                  Why choose <span className="rounded bg-accent px-2 py-0.5 text-primary">{BRAND_NAME}</span>?
                </h2>
                <p className="mt-3 max-w-lg text-muted">
                  Most QR menu tools stop at handing you a link. {BRAND_NAME} sets up your tables,
                  prints your kitchen slips, and keeps every rupee commission-free — every single day.
                </p>
              </Reveal>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {WHY_CARDS.map((c, i) => (
                  <Reveal key={c.title} delayMs={60 + i * 80}>
                    <div className="h-full rounded-2xl bg-primary p-6 text-white transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/25">
                      <h3 className="text-base font-bold text-accent">{c.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-white/75">{c.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>

              <Reveal delayMs={220}>
                <a
                  href="#contact"
                  className="sheen group mt-8 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Talk to us
                  <Icon
                    d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1"
                  />
                </a>
              </Reveal>
            </div>

            <Reveal delayMs={120}>
              <div className="group flex flex-col justify-between overflow-hidden rounded-[1.75rem] border border-primary/20 bg-primary p-7 text-white shadow-xl transition-transform duration-500 ease-out hover:-translate-y-1.5 sm:p-8 lg:min-h-[26rem]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold tracking-widest text-white/60 uppercase">Owner dashboard</span>
                  <Icon d={D.bell} className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="font-mono text-[11px] font-semibold tracking-widest text-white/50 uppercase">Today&apos;s sales</p>
                  <p className="mt-1 text-4xl font-bold tabular-nums sm:text-5xl">₹18,420</p>
                  <p className="mt-2 text-sm text-white/60">42 orders · every table turned at least twice</p>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3 transition-colors duration-300 ease-out group-hover:bg-white/15">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon d={D.chart} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">New order · Table 5</p>
                    <p className="truncate text-xs text-white/60">Paneer Tikka × 2, Cold Coffee × 1</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
          </div>
        </section>

        {/* ── Use cases ───────────────────────────────────────────────── */}
        <section aria-label="Who it's for" className="scroll-mt-20 bg-surface py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">Built for tables that turn fast</h2>
              <p className="mt-3 max-w-xl text-muted">Wherever people scan, order, and move on quickly.</p>
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {USE_CASES.map((u, i) => (
                <Reveal key={u.label} delayMs={i * 70} variant="scale">
                  <div className="group h-full overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10">
                    <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 transition-colors duration-300 ease-out group-hover:from-primary/15 group-hover:to-accent/15">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-surface text-primary shadow-sm transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-105">
                        <Icon d={u.icon} className="h-7 w-7" />
                      </span>
                    </div>
                    <p className="p-4 text-center text-base font-semibold text-foreground">{u.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────────────────── */}
        <section id="pricing" className="scroll-mt-20 bg-primary py-24 text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16">
            <Reveal>
              <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">Pricing</p>
              <h2 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Simple pricing. Zero commission. Ever.
              </h2>
              <p className="mt-4 max-w-md text-white/75">
                Two numbers, both flat: a one-time setup sized to your menu and table count, then a
                monthly subscription. Never a cut of an order. We quote both in one call, before you
                commit to anything.
              </p>

              <dl className="mt-8 grid max-w-md gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-dashed border-white/25 bg-white/[0.04] p-4">
                  <dt className="font-mono text-[10px] font-semibold tracking-[0.12em] text-white/50 uppercase">Setup</dt>
                  <dd className="mt-1 text-lg font-semibold">Once, up front</dd>
                  <dd className="mt-1 text-sm text-white/60">Menu built, QR stickers printed.</dd>
                </div>
                <div className="rounded-xl border border-dashed border-white/25 bg-white/[0.04] p-4">
                  <dt className="font-mono text-[10px] font-semibold tracking-[0.12em] text-white/50 uppercase">Subscription</dt>
                  <dd className="mt-1 text-lg font-semibold">Flat, monthly</dd>
                  <dd className="mt-1 text-sm text-white/60">Cancel whenever you want.</dd>
                </div>
              </dl>

              <a
                href="#contact"
                className="sheen mt-8 inline-block cursor-pointer rounded-xl bg-accent px-8 py-4 text-base font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-black/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Talk to us about pricing
              </a>
            </Reveal>

            <Reveal delayMs={120}>
              <div className="relative rounded-lg border border-dashed border-accent/50 bg-white/[0.04] p-7">
                <span
                  aria-hidden="true"
                  className="stamp absolute -top-3 -right-3 rounded border-2 border-accent bg-primary px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-accent uppercase"
                >
                  All included
                </span>
                <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
                  Every plan ships with
                </p>
                <ul className="mt-5 space-y-3.5">
                  {PLAN_INCLUDES.map((line) => (
                    <li key={line} className="flex items-start gap-3 text-sm text-white/85">
                      <Icon d="m4.5 12.75 6 6 9-13.5" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 border-t border-dashed border-white/25 pt-4 font-mono text-[11px] tracking-tight text-white/50">
                  No per-order fee · No lock-in · Your UPI, your account
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Lead form ───────────────────────────────────────────────── */}
        <section id="contact" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <Reveal>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">Get your cafe on {BRAND_NAME}</h2>
              <p className="mt-4 max-w-md text-muted">
                Leave your number and we&apos;ll call you back — or reach us straight away:
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-success px-5 py-3 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md hover:shadow-success/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
                >
                  <Icon d={D.whatsapp} className="h-5 w-5" />
                  WhatsApp us
                </a>
                <a
                  href={`tel:${CONTACT_PHONE_TEL}`}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition-all duration-150 hover:-translate-y-px hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Icon d={D.phone} className="h-5 w-5 text-primary" />
                  {CONTACT_PHONE_DISPLAY}
                </a>
              </div>
            </Reveal>
            <Reveal delayMs={100}>
              <LeadForm />
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

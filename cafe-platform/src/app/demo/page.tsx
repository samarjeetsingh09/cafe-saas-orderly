import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { BRAND_NAME, DEMO_CAFE_SLUG, WHATSAPP_URL } from "@/lib/brand";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Reveal } from "@/components/marketing/Reveal";
import "@/styles/demo-phone.css";

/**
 * "See a live demo" — the marketing site's one door into the real customer
 * app. It resolves a live table at request time instead of hardcoding a QR
 * token, because tokens rotate on every reseed and a pasted one goes stale
 * silently (the landing page's old `/demo-cafe` link 404'd for exactly that
 * kind of reason).
 *
 * It prefers the cafe named by `DEMO_CAFE_SLUG` — the one deliberately themed
 * to match this site, so the demo doesn't drop a visitor into an unrelated
 * cafe's palette — but the *only* thing hardcoded is the slug, in lib/brand.ts.
 * If that cafe is gone, paused, or has no open table, this falls back to the
 * original behaviour: the oldest table anywhere that is actually taking
 * orders. So the page degrades to "some real menu" rather than to a 404.
 *
 * This used to `redirect()` straight at `/t/{token}`, which answered "does it
 * work?" but not "what will this look like on my customer's phone?" — a
 * desktop visitor got a 1400px-wide column of a mobile-first app and no frame
 * of reference. Now the same route renders inside a phone: an <iframe> of the
 * genuine `/t/{token}`, at a genuine 390px device width, so the layout the
 * visitor judges is the layout a diner actually gets. Full screen is still one
 * click away for anyone who wants the raw thing.
 */
export const dynamic = "force-dynamic";

const OPEN_TABLE: Prisma.CafeTableWhereInput = {
  active: true,
  tenant: { deletedAt: null, status: { notIn: ["paused", "cancelled"] } },
};

const TABLE_FIELDS = {
  qrToken: true,
  label: true,
  tenant: { select: { name: true } },
} satisfies Prisma.CafeTableSelect;

/** What a visitor is meant to poke at — the three things that sell the app. */
const TRY_THESE = [
  {
    title: "Switch the kitchen",
    body: "Veg and non-veg are separate menus. One tap swaps the whole list.",
  },
  {
    title: "Add a dish to the order",
    body: "Pick a size, tap add, and watch the cart bar rise from the bottom.",
  },
  {
    title: "Open the order sheet",
    body: "Line items, GST and the total — the same summary your customer pays from.",
  },
] as const;

/**
 * Clock for the phone's status strip. Rendered on the server (the route is
 * already `force-dynamic`) so there's no hydration mismatch and no ticking
 * timer — a status bar that never changes is exactly what a screenshot of a
 * phone looks like. IST because that's every tenant's timezone default.
 */
function nowInIst() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date())
    .toLowerCase();
}

export const metadata = {
  title: `Live demo menu — ${BRAND_NAME}`,
  description: "Open a real table's QR menu and see exactly what your customers see.",
};

export default async function DemoPage() {
  const preferred = await prisma.cafeTable.findFirst({
    where: { ...OPEN_TABLE, tenant: { ...(OPEN_TABLE.tenant as Prisma.TenantWhereInput), slug: DEMO_CAFE_SLUG } },
    orderBy: { label: "asc" },
    select: TABLE_FIELDS,
  });

  const table =
    preferred ??
    (await prisma.cafeTable.findFirst({
      where: OPEN_TABLE,
      orderBy: [{ tenant: { createdAt: "asc" } }, { label: "asc" }],
      select: TABLE_FIELDS,
    }));

  if (!table) return <NoTableOpen />;

  const menuHref = `/t/${table.qrToken}`;

  return (
    <div className="text-foreground">
      <SiteHeader />

      <main className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-start gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1fr_auto] lg:gap-16 lg:pt-20 lg:pb-28">
          {/* ── Left: what am I looking at, and what should I tap ───────── */}
          <Reveal variant="left">
            <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-primary/40 bg-surface px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Live demo
            </span>

            <h1 className="font-display mt-6 text-[2.5rem] leading-[1.06] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]">
              This is the screen
              <span className="block text-primary">your customer gets.</span>
            </h1>

            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted">
              {/* Deliberately not "the phone on the right" — the grid stacks
                  below `lg`, where the phone sits underneath this copy. */}
              Not a video, not a mockup — that phone is running the real ordering app, on a real
              open table at <b className="font-semibold text-foreground">{table.tenant.name}</b>{" "}
              (table {table.label}), laid out at a real phone&apos;s width. Tap around inside it.
            </p>

            <ol className="mt-9 space-y-5 border-l border-dashed border-border pl-6">
              {TRY_THESE.map((t, i) => (
                <li key={t.title} className="relative">
                  <span className="absolute -left-[2.1rem] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface font-mono text-[11px] font-semibold text-primary tabular-nums">
                    {i + 1}
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">{t.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{t.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href={menuHref}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Open it full screen ↗
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer rounded-xl bg-success px-5 py-3 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
              >
                WhatsApp us
              </a>
              <Link
                href="/#contact"
                className="cursor-pointer rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold transition-all duration-150 hover:-translate-y-px hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Ask for a callback
              </Link>
            </div>

            <p className="mt-6 max-w-md font-mono text-[11px] leading-relaxed tracking-wide text-muted/80">
              Your own menu wears your own colours, logo and dishes — the theme here belongs to the
              cafe, not to {BRAND_NAME}.
            </p>
          </Reveal>

          {/* ── Right: the phone ─────────────────────────────────────────── */}
          {/* The phone is taller than the copy beside it, so it's pulled up by
              half the difference: it overhangs evenly top and bottom instead
              of hanging off the bottom alone. Only from `lg`, where the two
              actually sit side by side. */}
          <Reveal variant="right" delayMs={120} className="justify-self-center lg:sticky lg:top-24 lg:-mt-5">
            <div className="relative w-fit">
              {/* Same paper chit the hero phone wears — the artefact this
                  screen came from, pinned to it. Real table, unlike the
                  hero's sample. */}
              <div
                aria-hidden="true"
                className="absolute -top-4 -left-6 z-20 hidden -rotate-6 rounded-sm border border-dashed border-primary/30 bg-surface px-3 py-1.5 font-mono text-[10px] font-semibold tracking-wider text-muted uppercase shadow-sm sm:block"
              >
                Table {table.label} · scanned just now
              </div>

              <div className="demo-phone">
                <span className="dp-glow" aria-hidden="true" />
                <div className="dp-ear" aria-hidden="true">
                  <i />
                  <b />
                </div>
                <div className="dp-screen">
                  <div className="dp-status" aria-hidden="true">
                    <span>{nowInIst()}</span>
                    <span className="dp-bars">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                  <iframe
                    src={menuHref}
                    title={`Live customer menu for ${table.tenant.name}, table ${table.label}`}
                    loading="eager"
                  />
                </div>
                <div className="dp-home" aria-hidden="true">
                  <i />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Every cafe is paused, deleted, or has no active table. */
function NoTableOpen() {
  return (
    <div className="text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-2xl flex-col items-start px-4 py-24 sm:px-6">
        <span className="rounded-full border border-dashed border-primary/40 bg-surface px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
          Demo menu
        </span>
        <h1 className="font-display mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          No demo table is open right now
        </h1>
        <p className="mt-4 text-muted">
          Message us and we&apos;ll send you a live menu link, or walk you through the whole flow on
          a call.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer rounded-xl bg-success px-5 py-3 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
          >
            WhatsApp us
          </a>
          <Link
            href="/#contact"
            className="cursor-pointer rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold transition-all duration-150 hover:-translate-y-px hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Ask for a callback
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

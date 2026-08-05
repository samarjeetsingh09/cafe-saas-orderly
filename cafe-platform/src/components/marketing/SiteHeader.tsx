import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { Icon, D } from "@/components/marketing/icons";

/* Split either side of the centred wordmark. Keep the halves close in width
   or the logo stops reading as the optical centre of the bar. */
const NAV_LEFT = [
  { href: "/about", label: "About us" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
] as const;

const NAV_RIGHT = [
  { href: "/#pricing", label: "Pricing" },
  { href: "/demo", label: "Live demo" },
] as const;

const NAV_ALL = [...NAV_LEFT, ...NAV_RIGHT];

const linkClass =
  "nav-underline rounded-sm transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

/**
 * Shared top nav — used by the landing page and every standalone marketing
 * page (About, demo) so nav/branding never drifts between them.
 *
 * Shape: a floating pill that hovers over the page rather than a full-bleed
 * bar welded to the top edge. It reads as a physical object, which takes
 * both halves of the lighting: a bright inset rim along the top edge plus a
 * soft warm inset at the bottom (light falling on a curved surface), and two
 * outer shadows — a tight contact shadow and a wide, very soft cast shadow
 * that sells the gap between pill and page. Drop either half and it flattens
 * back into a rectangle with rounded corners.
 *
 * The wordmark sits dead centre, so the grid is
 * `1fr auto 1fr` at every size — the side cells stay equal-width whatever
 * they hold, which is what keeps the logo actually centred instead of
 * merely between two things. On small screens those cells carry the login
 * icon and the menu toggle; on desktop they carry the section links.
 *
 * Still a server component: the small-screen menu is a plain `<details>`,
 * no hydration cost for a nav that only has to open and close.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 pb-3 sm:px-5 sm:pt-4 sm:pb-4">
      <nav
        aria-label="Main"
        className="relative mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-full border border-white/60 bg-gradient-to-b from-white/85 to-background/70 px-4 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.9),inset_0_0_0_1px_rgb(255_255_255/0.35),inset_0_-8px_16px_-10px_rgb(124_63_0/0.18),0_1px_2px_rgb(43_43_43/0.05),0_10px_24px_-12px_rgb(124_63_0/0.3),0_32px_60px_-28px_rgb(124_63_0/0.45)] ring-1 ring-border/60 backdrop-blur-xl sm:px-6 sm:py-3.5"
      >
        {/* Reading progress — CSS scroll-timeline, no JS, no layout cost.
            Its own clipped track so the pill itself can stay un-clipped for
            the mobile menu popover. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 bottom-[6px] h-[2px] overflow-hidden rounded-full"
        >
          <span className="scroll-progress block h-full w-full bg-accent" />
        </span>

        {/* ── Left cell ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-start">
          <div className="hidden items-center gap-6 pl-2 font-mono text-[13px] font-medium tracking-tight text-foreground/80 md:flex">
            {NAV_LEFT.map((n) => (
              <Link key={n.href} href={n.href} className={linkClass}>
                {n.label}
              </Link>
            ))}
          </div>
          <Link
            href="/owner/login"
            aria-label="Owner login"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-white/70 text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(124_63_0/0.12)] transition-colors duration-150 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:hidden"
          >
            <Icon d={D.user} className="h-4 w-4" />
          </Link>
        </div>

        {/* ── Centre: the wordmark ──────────────────────────────────── */}
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-primary shadow-[inset_0_1px_2px_rgb(124_63_0/0.25)]"
          >
            <span className="h-3.5 w-3.5 rounded-full bg-accent shadow-[0_1px_2px_rgb(124_63_0/0.4)]" />
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight text-primary">{BRAND_NAME}</span>
        </Link>

        {/* ── Right cell ────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 sm:gap-4">
          <div className="hidden items-center gap-6 font-mono text-[13px] font-medium tracking-tight text-foreground/80 md:flex">
            {NAV_RIGHT.map((n) => (
              <Link key={n.href} href={n.href} className={linkClass}>
                {n.label}
              </Link>
            ))}
          </div>

          <span aria-hidden="true" className="hidden h-4 w-px bg-border md:block" />

          <Link
            href="/owner/login"
            className="hidden items-center gap-1.5 rounded-sm font-mono text-[13px] font-medium tracking-tight text-foreground/80 transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary md:flex"
          >
            <Icon d={D.user} className="h-4 w-4" />
            Login
          </Link>

          <Link
            href="/#contact"
            className="hidden cursor-pointer rounded-full bg-gradient-to-b from-secondary to-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),inset_0_-2px_4px_rgb(0_0_0/0.15),0_2px_6px_-1px_rgb(124_63_0/0.4)] transition-all duration-150 hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.32),inset_0_-2px_4px_rgb(0_0_0/0.15),0_6px_14px_-3px_rgb(124_63_0/0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:inline-flex"
          >
            Get started
          </Link>

          {/* Small screens: the section links live behind this. */}
          <details className="group relative md:hidden">
            <summary
              aria-label="Open menu"
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-border/80 bg-white/70 text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(124_63_0/0.12)] transition-colors duration-150 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
            >
              <Icon d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" className="h-5 w-5 group-open:hidden" />
              <Icon d="M6 18 18 6M6 6l12 12" className="hidden h-5 w-5 group-open:block" />
            </summary>
            <div className="absolute right-0 z-50 mt-4 w-56 rounded-2xl border border-border bg-surface p-2 shadow-lg shadow-primary/10">
              {NAV_ALL.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-background hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {n.label}
                </Link>
              ))}
              <Link
                href="/#contact"
                className="mt-1 block rounded-xl border-t border-dashed border-border px-3 py-2.5 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:hidden"
              >
                Get started
              </Link>
              <Link
                href="/owner/login"
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon d={D.user} className="h-4 w-4" />
                Owner login
              </Link>
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}

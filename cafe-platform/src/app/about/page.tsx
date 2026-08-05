import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { Reveal } from "@/components/marketing/Reveal";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Icon, D } from "@/components/marketing/icons";

export const metadata = {
  title: `About us — ${BRAND_NAME}`,
  description: `Why we built ${BRAND_NAME}: commission-free QR ordering, set up end-to-end for independent Indian cafes.`,
};

const VALUES = [
  { icon: D.upi, title: "Zero commission, ever", body: "Payments land in your account, not ours. We charge a flat subscription — never a cut of your orders." },
  { icon: D.printer, title: "We set it up, not just ship a link", body: "Menu, tables, QR stickers, kitchen printing — our team does the setup so you're not learning new software mid-service." },
  { icon: D.user, title: "Built with cafe owners", body: "Every feature comes from a real counter conversation, not a boardroom guess at what a cafe needs." },
] as const;

/**
 * Standalone About page — placeholder structure + copy for the founder to
 * replace with the real story. Reuses the same header/footer, type scale
 * and Reveal motion as the landing page so it never reads as a separate site.
 */
export default function AboutPage() {
  return (
    <div className="text-foreground">
      <SiteHeader />

      <main>
        {/* ── Intro ───────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 lg:pt-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">About us</p>
            <h1 className="font-display mt-3 text-5xl font-semibold tracking-tight text-balance text-foreground sm:text-6xl">
              Built by people who&apos;ve run a cafe counter
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              {BRAND_NAME} started after watching independent cafes hand over a quarter of every
              order to aggregator apps just to go digital. We build the QR ordering, kitchen
              printing, and payments a small cafe actually needs — and set it all up ourselves, so
              you keep running your kitchen instead of learning new software.
            </p>
          </Reveal>
        </section>

        {/* ── Story (signature dark band, matches the commission band) ──── */}
        <section className="chit-edge-b on-dark bg-[#2b2016] py-20 text-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal>
              <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">Why we exist</p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Aggregators sell reach. We sell ownership.
              </h2>
              <p className="mt-5 leading-relaxed text-white/75">
                [Replace this paragraph with the real founder story — how {BRAND_NAME} started,
                which cafe it was built for first, and what changed once they stopped paying
                commission.]
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── What we believe ────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">What we believe</p>
            <h2 className="font-display mt-3 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
              Three things we won&apos;t compromise on
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {VALUES.map((v) => (
              <Reveal key={v.title}>
                <div className="h-full rounded-2xl border border-border bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                  <span className="inline-flex rounded-xl border border-primary/15 bg-surface p-2.5 text-primary shadow-sm">
                    <Icon d={v.icon} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{v.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <section className="bg-surface py-20">
          <Reveal className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <h2 className="font-display text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
              Want to talk to us directly?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted">
              Tell us about your cafe and we&apos;ll walk you through what going live looks like.
            </p>
            <Link
              href="/#contact"
              className="mt-10 inline-block cursor-pointer rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-primary/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Get in touch
            </Link>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

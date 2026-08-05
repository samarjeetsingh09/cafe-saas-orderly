import Link from "next/link";
import { BRAND_NAME, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/brand";

/** Shared footer — used by the landing page and every standalone marketing page (About, etc.) so nav/branding never drifts between them. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-sm">
          <p className="font-display text-xl font-semibold text-primary">{BRAND_NAME}</p>
          <p className="mt-2 text-sm text-muted">
            QR menus and table-side ordering for independent Indian cafes — commission-free,
            UPI-first, and live in days.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
          <Link href="/about" className="rounded-sm text-muted transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">About us</Link>
          <Link href="/#how-it-works" className="rounded-sm text-muted transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">How it works</Link>
          <Link href="/#features" className="rounded-sm text-muted transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Features</Link>
          <Link href="/#pricing" className="rounded-sm text-muted transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Pricing</Link>
          <Link href="/demo" className="rounded-sm text-muted transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Live demo menu</Link>
          <Link href="/owner/login" className="rounded-sm text-muted transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Owner login</Link>
          <a href={`tel:${CONTACT_PHONE_TEL}`} className="rounded-sm text-muted transition-colors duration-150 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {CONTACT_PHONE_DISPLAY}
          </a>
        </nav>
      </div>
      <p className="border-t border-border py-4 text-center font-mono text-xs text-muted">
        © {new Date().getFullYear()} {BRAND_NAME} · All rights reserved
      </p>
    </footer>
  );
}

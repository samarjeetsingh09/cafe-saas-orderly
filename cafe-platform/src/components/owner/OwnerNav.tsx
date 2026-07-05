"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * Owner dashboard navigation (DESIGN_SYSTEM 2: mobile bottom tab bar
 * Home/Orders/Menu/More with a More sheet; desktop left sidebar, all 7).
 * Neutral slate base, --primary as the single accent.
 */

type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const PRIMARY_TABS: NavItem[] = [
  { href: "/owner/home", label: "Home", icon: "home" },
  { href: "/owner/orders", label: "Orders", icon: "orders" },
  { href: "/owner/menu", label: "Menu", icon: "menu" },
];

const MORE_TABS: NavItem[] = [
  { href: "/owner/qr-codes", label: "QR Codes", icon: "qr" },
  { href: "/owner/billing", label: "Billing", icon: "billing" },
  { href: "/owner/support", label: "Support", icon: "support" },
  { href: "/owner/reports", label: "Reports", icon: "reports" },
];

const ICONS = {
  home: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 12 11.2 3.05a1.125 1.125 0 0 1 1.59 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
    />
  ),
  orders: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 4.5h6M8.25 2.25A2.25 2.25 0 0 0 6 4.5v15A2.25 2.25 0 0 0 8.25 21.75h7.5A2.25 2.25 0 0 0 18 19.5v-15a2.25 2.25 0 0 0-2.25-2.25h-7.5ZM9 8.25h6m-6 3.75h6m-6 3.75h3.75"
    />
  ),
  menu: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
    />
  ),
  qr: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z M6.75 6.75h.008v.008H6.75V6.75Zm0 9.75h.008v.008H6.75v-.008Zm9.75-9.75h.008v.008h-.008V6.75Zm-3 6h.008v.008H13.5v-.008Zm0 6h.008v.008H13.5v-.008Zm6-6h.008v.008h-.008v-.008Zm0 6h.008v.008h-.008v-.008Zm-3-3h.008v.008H16.5v-.008Z"
    />
  ),
  billing: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
    />
  ),
  support: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
    />
  ),
  reports: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
    />
  ),
  more: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
    />
  ),
  logout: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
    />
  ),
} as const;

function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function useLogout() {
  const router = useRouter();
  return async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/owner/login");
    router.refresh();
  };
}

export function OwnerNav({ cafeName }: { cafeName: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const logout = useLogout();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const moreActive = MORE_TABS.some((t) => isActive(t.href));

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 py-5">
          <p className="truncate text-base font-semibold text-slate-900">{cafeName}</p>
          <p className="mt-0.5 text-xs font-medium tracking-wide text-slate-400 uppercase">
            Owner dashboard
          </p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
          {[...PRIMARY_TABS, ...MORE_TABS].map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={isActive(t.href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                isActive(t.href)
                  ? "bg-primary/10 text-primary"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon name={t.icon} className="h-5 w-5 shrink-0" />
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={logout}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
          >
            <Icon name="logout" className="h-5 w-5 shrink-0" />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Mobile top header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <p className="truncate text-base font-semibold text-slate-900">{cafeName}</p>
      </header>

      {/* ── Mobile bottom tab bar ───────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Dashboard tabs"
      >
        {PRIMARY_TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive(t.href) ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              isActive(t.href) ? "text-primary" : "text-slate-500"
            }`}
          >
            <Icon name={t.icon} className="h-6 w-6" />
            {t.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className={`flex cursor-pointer flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
            moreActive ? "text-primary" : "text-slate-500"
          }`}
        >
          <Icon name="more" className="h-6 w-6" />
          More
        </button>
      </nav>

      {/* ── More sheet (mobile) ─────────────────────────────────────── */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 cursor-pointer bg-slate-900/40"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl motion-safe:animate-[slideUp_200ms_ease-out]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
            <div className="space-y-1">
              {MORE_TABS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                    isActive(t.href) ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon name={t.icon} className="h-5 w-5" />
                  {t.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={logout}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <Icon name="logout" className="h-5 w-5" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

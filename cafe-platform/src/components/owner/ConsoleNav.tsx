"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { can, type Capability } from "@/lib/permissions";
import type { ProfileRole } from "@prisma/client";

/**
 * Top bar + tab nav, ported verbatim from plan/bella-admin-console.html's
 * `.top`/`.nav` (Phase D, plan/START-HERE.md). Styling lives in
 * styles/console.css; this component only supplies structure + behaviour
 * (route highlighting, live clock, logout, the "Live orders" badge).
 *
 * Tabs whose page already redirects a non-permitted role away (Reports,
 * QR codes, Plan — see each page's own `can()` guard) are hidden here too,
 * so a waiter never sees a tab that just bounces them back. This is UX, not
 * the security boundary — every route still enforces its own guard
 * server-side (`lib/permissions.ts`'s docstring).
 */
const TABS: { href: string; label: string; capability?: Capability }[] = [
  { href: "/owner/orders", label: "Live orders" },
  { href: "/owner/tables", label: "Tables" },
  { href: "/owner/menu", label: "Menu" },
  { href: "/owner/qr-codes", label: "QR codes", capability: "viewQrCodes" },
  { href: "/owner/reports", label: "Reports", capability: "viewReports" },
  { href: "/owner/billing", label: "Plan", capability: "manageBilling" },
  { href: "/owner/support", label: "Support" },
];

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  waiter: "Floor",
  kitchen: "Kitchen",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function useClock(): string {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const format = () =>
      new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ticking wall clock, not derived state
    setNow(format());
    const id = setInterval(() => setNow(format()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now ?? "--:--";
}

export function ConsoleNav({
  tenantName,
  fullName,
  role,
  newOrderCount,
}: {
  tenantName: string;
  fullName: string;
  role: string;
  newOrderCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const clock = useClock();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/owner/login");
    router.refresh();
  }

  return (
    <>
      <div className="top">
        <div className="mark">
          <span className="n">{tenantName}</span>
          <span className="r">Staff Console</span>
        </div>
        <span className="live">
          <i className="pulse" />
          Live
        </span>
        <div className="spacer" />
        <div className="clock">{clock}</div>
        <div className="who">
          <span className="av">{initials(fullName)}</span>
          {fullName} · {ROLE_LABEL[role] ?? role}
        </div>
      </div>

      <nav className="nav">
        {TABS.filter((t) => !t.capability || can(role as ProfileRole, t.capability)).map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.href} href={t.href} aria-current={active}>
              {t.label}
              {t.href === "/owner/orders" && newOrderCount > 0 && <span className="badge">{newOrderCount}</span>}
            </Link>
          );
        })}
        <button className="logout" onClick={logout}>
          Log out
        </button>
      </nav>
    </>
  );
}

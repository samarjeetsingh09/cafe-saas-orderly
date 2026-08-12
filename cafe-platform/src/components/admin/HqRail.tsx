"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { canHq, type HqCapability } from "@/lib/hq-permissions";
import type { PlatformRole } from "@prisma/client";
import {
  IconGauge,
  IconStore,
  IconPulse,
  IconFunnel,
  IconCard,
  IconLayers,
  IconList,
  IconChat,
  IconCog,
} from "@/components/admin/ui/icons";

/**
 * Left navigation rail. Replaces the first pass's top tab bar: HQ now has
 * nine destinations, and top tabs stop working as a wayfinding device past
 * about six — a vertical rail also leaves the full page width for the dense
 * tables this console is mostly made of.
 *
 * Items are filtered by capability, matching each route's own server-side
 * guard (`lib/hq-permissions.ts`). Hiding is UX; the guard is the boundary.
 */
type Item = { href: string; label: string; Icon: (p: { className?: string }) => React.JSX.Element; capability?: HqCapability; count?: number };

const GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "Operate",
    items: [
      { href: "/admin", label: "Dashboard", Icon: IconGauge },
      { href: "/admin/cafes", label: "Cafes", Icon: IconStore },
      { href: "/admin/monitoring", label: "Monitoring", Icon: IconPulse },
      { href: "/admin/support", label: "Support", Icon: IconChat, capability: "supportInbox" },
    ],
  },
  {
    heading: "Grow",
    items: [
      { href: "/admin/leads", label: "Leads", Icon: IconFunnel },
      { href: "/admin/billing", label: "Billing", Icon: IconCard },
      { href: "/admin/templates", label: "Templates", Icon: IconLayers },
    ],
  },
  {
    heading: "Records",
    items: [
      { href: "/admin/activity", label: "Activity", Icon: IconList, capability: "readActivity" },
      { href: "/admin/settings", label: "Settings", Icon: IconCog, capability: "managePlatformUsers" },
    ],
  },
];

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  ops: "Ops",
  support: "Support",
};

export function HqRail({
  fullName,
  role,
  openTickets,
  attention,
}: {
  fullName: string;
  role: string;
  openTickets: number;
  attention: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const countFor = (href: string) =>
    href === "/admin/support" ? openTickets : href === "/admin/monitoring" ? attention : undefined;

  return (
    <aside className="hq-rail">
      <div className="hq-brand">
        <span className="dot" aria-hidden="true">
          <i />
        </span>
        Cafiyara <em>HQ</em>
      </div>

      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !i.capability || canHq(role as PlatformRole, i.capability));
        if (!items.length) return null;
        return (
          <div key={g.heading}>
            <div className="hq-navgroup">{g.heading}</div>
            <nav className="hq-nav">
              {items.map(({ href, label, Icon }) => {
                const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
                const count = countFor(href);
                return (
                  <Link key={href} href={href} aria-current={active ? "true" : undefined}>
                    <Icon />
                    {label}
                    {!!count && <span className="count">{count > 99 ? "99+" : count}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
        );
      })}

      <div className="hq-railfoot">
        <b>{fullName}</b>
        {ROLE_LABEL[role] ?? role}
        <br />
        <button onClick={logout}>Sign out</button>
      </div>
    </aside>
  );
}

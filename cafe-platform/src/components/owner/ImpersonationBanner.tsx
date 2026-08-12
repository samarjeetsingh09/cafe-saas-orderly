"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Persistent top banner during an HQ "login as owner" session
 * (HQ-PORTAL-SPEC.md §8) — impossible to forget you're inside a customer's
 * account. Rendered by the owner dash layout whenever the session carries
 * `impersonatedBy` (see lib/session.ts).
 */
export function ImpersonationBanner({ fullName, tenantName }: { fullName: string; tenantName: string }) {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  async function exit() {
    setExiting(true);
    const res = await fetch("/api/admin/impersonation/exit", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    router.replace(data.tenantId ? `/admin/cafes/${data.tenantId}` : "/admin/cafes");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-[#d97706] px-4 py-2 text-sm font-medium text-[#241305]">
      <span>
        Viewing as {fullName} ({tenantName}) — Cafiyara staff session
      </span>
      <button
        onClick={exit}
        disabled={exiting}
        className="rounded-md bg-[#241305] px-2.5 py-1 text-xs font-semibold text-[#f5ede3] hover:bg-[#241305]/90 disabled:opacity-60"
      >
        {exiting ? "Exiting…" : "Exit"}
      </button>
    </div>
  );
}

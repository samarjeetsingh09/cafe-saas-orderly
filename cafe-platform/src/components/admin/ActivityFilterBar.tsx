"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ActivityFilterBar({ actions, tenants }: { actions: string[]; tenants: { id: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/activity?${params.toString()}`);
  }

  function exportCsv() {
    // The export follows the current filters — an unfiltered dump of an
    // append-only log is rarely what anyone actually wants.
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", "csv");
    window.location.href = `/api/admin/activity?${params.toString()}`;
  }

  const dirty = Boolean(
    searchParams.get("actorEmail") || searchParams.get("action") || searchParams.get("tenantId") || searchParams.get("from") || searchParams.get("to")
  );

  return (
    <div className="hq-toolbar">
      <input
        type="search"
        defaultValue={searchParams.get("actorEmail") ?? ""}
        onBlur={(e) => setParam("actorEmail", e.target.value)}
        placeholder="Actor email…"
        aria-label="Filter by actor email"
      />
      <select defaultValue={searchParams.get("action") ?? ""} onChange={(e) => setParam("action", e.target.value)} aria-label="Action filter">
        <option value="">All actions</option>
        {actions.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <select defaultValue={searchParams.get("tenantId") ?? ""} onChange={(e) => setParam("tenantId", e.target.value)} aria-label="Cafe filter">
        <option value="">All cafes</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input type="date" defaultValue={searchParams.get("from") ?? ""} onChange={(e) => setParam("from", e.target.value)} aria-label="From date" />
      <span style={{ fontSize: 11, color: "var(--hq-text-3)" }}>to</span>
      <input type="date" defaultValue={searchParams.get("to") ?? ""} onChange={(e) => setParam("to", e.target.value)} aria-label="To date" />
      <button className="hq-btn" onClick={exportCsv}>
        Export CSV
      </button>
      {dirty && (
        <button className="hq-btn" data-variant="ghost" data-size="sm" onClick={() => router.push("/admin/activity")}>
          Clear filters
        </button>
      )}
    </div>
  );
}

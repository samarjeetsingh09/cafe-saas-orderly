"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function CafesFilterBar({ plans }: { plans: { id: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // Any filter change invalidates the current page number — page 4 of the
    // old result set is meaningless against the new one.
    params.delete("page");
    router.push(`/admin/cafes?${params.toString()}`);
  }

  const dirty = Boolean(searchParams.get("search") || searchParams.get("status") || searchParams.get("planId") || searchParams.get("noOrders"));

  return (
    <div className="hq-toolbar">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("search", search);
        }}
      >
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, slug or owner email…" />
      </form>
      <select defaultValue={searchParams.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)} aria-label="Status filter">
        <option value="">All statuses</option>
        <option value="trial">Trial</option>
        <option value="active">Active</option>
        <option value="paused">Paused</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select defaultValue={searchParams.get("planId") ?? ""} onChange={(e) => setParam("planId", e.target.value)} aria-label="Plan filter">
        <option value="">All plans</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <label className="hq-check">
        <input type="checkbox" defaultChecked={searchParams.get("noOrders") === "1"} onChange={(e) => setParam("noOrders", e.target.checked ? "1" : "")} />
        <span>No orders today</span>
      </label>
      {dirty && (
        <button className="hq-btn" data-variant="ghost" data-size="sm" onClick={() => router.push("/admin/cafes")}>
          Clear filters
        </button>
      )}
    </div>
  );
}

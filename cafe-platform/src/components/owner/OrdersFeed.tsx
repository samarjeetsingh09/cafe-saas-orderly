"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OwnerOrderDTO } from "@/lib/owner-orders";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const POLL_MS = 8000; // stop-gap until M7 realtime

/**
 * Owner Orders feed (M6). Amber row while cash is uncollected, green once
 * collected (DESIGN_SYSTEM 2). "Mark Collected" is race-safe server-side;
 * a lost race surfaces as "already collected" and the row settles green.
 */
export function OrdersFeed({ initialOrders }: { initialOrders: OwnerOrderDTO[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/orders", { cache: "no-store" });
      if (!res.ok) return; // keep showing the last good list
      const data: { orders: OwnerOrderDTO[] } = await res.json();
      setOrders(data.orders);
    } catch {
      // offline blip — next poll retries
    }
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  const markCollected = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/owner/orders/${id}/collect`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showNotice(data.error === "Already collected" ? "Already collected by someone else." : (data.error ?? "Could not update. Try again."));
      }
    } catch {
      showNotice("Network problem. Try again.");
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  return (
    <div>
      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-info/30 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {notice}
        </p>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-base font-medium text-slate-700">No orders yet today</p>
          <p className="mt-1 text-sm text-slate-500">New orders show up here on their own.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} busy={busyId === o.id} onCollect={() => markCollected(o.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<OwnerOrderDTO["paymentStatus"], { row: string; badge: string; label: string }> = {
  cash_pending: {
    row: "border-amber-300 bg-amber-50",
    badge: "bg-amber-100 text-amber-800",
    label: "Cash pending",
  },
  collected: {
    row: "border-emerald-200 bg-emerald-50/60",
    badge: "bg-emerald-100 text-emerald-800",
    label: "Money collected",
  },
  paid: {
    row: "border-emerald-200 bg-white",
    badge: "bg-emerald-100 text-emerald-800",
    label: "Paid online",
  },
  payment_pending: {
    row: "border-slate-200 bg-slate-50 opacity-80",
    badge: "bg-slate-200 text-slate-600",
    label: "Confirming payment",
  },
};

function OrderRow({
  order,
  busy,
  onCollect,
}: {
  order: OwnerOrderDTO;
  busy: boolean;
  onCollect: () => void;
}) {
  const s = STATUS_STYLES[order.paymentStatus];
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(order.createdAt));

  return (
    <li className={`rounded-xl border p-4 shadow-sm transition-colors duration-300 ${s.row}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-slate-900">
              #{order.orderNumber}
            </span>
            <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
              Table {order.tableNumber}
            </span>
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${s.badge}`}>{s.label}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {time} · {order.customerName}
          </p>
        </div>
        <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
          ₹{inr.format(order.totalAmount)}
        </p>
      </div>

      <ul className="mt-3 space-y-0.5 text-sm text-slate-700">
        {order.items.map((it, i) => (
          <li key={i}>
            <span className="font-semibold tabular-nums">{it.quantity} ×</span> {it.name}
          </li>
        ))}
      </ul>

      {order.paymentStatus === "payment_pending" && (
        <p className="mt-3 text-xs font-medium text-slate-500">
          Waiting for payment — don&apos;t prepare this order yet.
        </p>
      )}

      {order.paymentStatus === "cash_pending" && (
        <button
          type="button"
          disabled={busy}
          onClick={onCollect}
          className="mt-4 w-full cursor-pointer rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-50"
        >
          {busy ? "Marking…" : "Mark Collected"}
        </button>
      )}
    </li>
  );
}

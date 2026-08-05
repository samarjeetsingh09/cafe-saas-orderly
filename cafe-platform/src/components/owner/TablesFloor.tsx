"use client";

import { useState } from "react";
import type { TableCardDTO } from "@/lib/owner-tables";
import type { BoardOrderDTO } from "@/lib/owner-board";
import { TakeOrderModal } from "@/components/owner/TakeOrderModal";

const money = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");

/** Tables floor — ported verbatim from bella-admin-console.html's "Tables" tab (Phase H #3). */
export function TablesFloor({ tables, canTakeOrder }: { tables: TableCardDTO[]; canTakeOrder: boolean }) {
  const [modalTable, setModalTable] = useState<{ id: string; label: string } | undefined>();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function openFor(t: TableCardDTO) {
    if (!canTakeOrder) return;
    setModalTable({ id: t.id, label: t.label });
    setOpen(true);
  }

  return (
    <section>
      <h2 className="title">Tables</h2>
      <p className="sub-t">
        {tables.length} covers{canTakeOrder ? " · tap a table to punch an order in for it" : ""}
      </p>
      <div className="floor">
        {tables.map((t) => {
          const cls = t.status === "due" ? " due" : t.status === "busy" ? " busy" : "";
          const label = t.status === "due" ? "Bill due" : t.status === "busy" ? `${t.openOrders} order${t.openOrders > 1 ? "s" : ""} live` : "Free";
          return (
            <div key={t.id} className={`tbl${cls}`} style={{ cursor: canTakeOrder ? "pointer" : "default" }} onClick={() => openFor(t)}>
              <div className="no">{t.label}</div>
              <div className="st">{label}</div>
              {t.billPaise ? <div className="amt">{money(t.billPaise)}</div> : null}
            </div>
          );
        })}
      </div>

      {canTakeOrder && (
        <TakeOrderModal
          open={open}
          onClose={() => setOpen(false)}
          presetTable={modalTable}
          onPlaced={(order: BoardOrderDTO) => setToast(`${order.code} punched in for table ${order.tableLabel}`)}
        />
      )}
      <div className={`toast${toast ? " show" : ""}`}>{toast ?? ""}</div>
    </section>
  );
}

"use client";

import { useEffect } from "react";

/**
 * Shared scrim+panel shell — ported from bella-admin-console.html's
 * `.scrim`/`.modal` (`openModal()`/`closeModal()`). Reused by every Phase H
 * tab's forms (menu, QR request, plan change, support) and the take-an-order
 * POS (`wide`).
 */
export function Modal({
  open,
  onClose,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`scrim${open ? " show" : ""}`} onClick={onClose} />
      <div className={`modal${open ? " show" : ""}${wide ? " wide" : ""}`} role="dialog" aria-modal="true">
        {open ? children : null}
      </div>
    </>
  );
}

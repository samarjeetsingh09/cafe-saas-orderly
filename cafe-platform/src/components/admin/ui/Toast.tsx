"use client";

import { createContext, useCallback, useContext, useState } from "react";

/**
 * Toasts replace the inline `{error && <p>}` blocks the first HQ pass used —
 * an ops console fires a lot of small mutations (suspend, assign, reply) and
 * each one needs confirmation without the layout jumping.
 */
type Toast = { id: number; msg: string; tone: "neutral" | "ok" | "danger" };
type Ctx = { push: (msg: string, tone?: Toast["tone"]) => void };

const ToastCtx = createContext<Ctx>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((msg: string, tone: Toast["tone"] = "neutral") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="hq-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="hq-toast" data-tone={t.tone === "neutral" ? undefined : t.tone}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

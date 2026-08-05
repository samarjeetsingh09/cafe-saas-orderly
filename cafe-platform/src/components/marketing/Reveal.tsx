"use client";

import { useEffect, useRef } from "react";

/**
 * One-time fade-in on first scroll into view. No repeat, no loop — plain
 * CSS transition (.reveal / .is-in in globals.css) toggled by a single
 * IntersectionObserver entry. Respects prefers-reduced-motion via CSS (the
 * class becomes a no-op there).
 *
 * `variant` picks which way the block arrives from, so a row can be
 * choreographed rather than every element rising identically.
 */
export function Reveal({
  children,
  className = "",
  delayMs = 0,
  variant = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  variant?: "up" | "left" | "right" | "scale";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          window.setTimeout(() => el.classList.add("is-in"), delayMs);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delayMs]);

  return (
    <div ref={ref} data-v={variant} className={`reveal ${className}`}>
      {children}
    </div>
  );
}

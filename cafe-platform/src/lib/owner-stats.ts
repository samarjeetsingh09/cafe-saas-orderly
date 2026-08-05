/**
 * "Today" is the cafe's business day in IST (UTC+05:30, no DST) regardless
 * of server timezone — shared by the board (`lib/owner-board.ts`), kitchen
 * (`lib/kitchen.ts`) and tables floor (`lib/owner-tables.ts`).
 *
 * The M6-era `getTodayStats()` that used to live here was pre-Tenant-rename
 * (`cafeId`, `paymentStatus` enum) and powered the Home tab, which is
 * retired — `/owner/home` now redirects straight to `/owner/orders`
 * (Phase D), and the stats it needs live in `lib/owner-board.ts` instead.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** UTC instant of today's 00:00 IST. */
export function istDayStart(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

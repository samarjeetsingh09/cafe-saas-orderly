/**
 * In-memory login throttle — Security doc 2.2 / 5.4: lock an account after
 * 5 failed attempts for a few minutes. Single-VPS deployment (one Node
 * process under PM2), so process memory is an acceptable store for MVP.
 */

const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60 * 1000;

type Entry = { failures: number; lockedUntil: number };

const attempts = new Map<string, Entry>();

/** True if this account is currently locked out. */
export function isLocked(key: string): boolean {
  const e = attempts.get(key);
  if (!e) return false;
  if (e.lockedUntil > Date.now()) return true;
  if (e.lockedUntil > 0) attempts.delete(key); // lock expired — clean slate
  return false;
}

/** Record a failed attempt; locks the account on the 5th. */
export function recordFailure(key: string): void {
  const e = attempts.get(key) ?? { failures: 0, lockedUntil: 0 };
  e.failures += 1;
  if (e.failures >= MAX_FAILURES) e.lockedUntil = Date.now() + LOCK_MS;
  attempts.set(key, e);
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}

/**
 * Generic fixed-window counter (e.g. M4: max N orders per table per minute).
 * Returns true when the action is allowed.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function allowInWindow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}

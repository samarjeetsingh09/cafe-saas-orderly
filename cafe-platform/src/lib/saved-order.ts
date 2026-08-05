/**
 * "Which orders is this phone currently tracking?" — the one bit of customer
 * state that has to outlive the React tree.
 *
 * Everything else in the ordering app is deliberately ephemeral (a cart
 * belongs to the session, not the device), but the order tracker isn't: once
 * money is committed, hitting Back or locking the phone must not be the
 * thing that decides whether a customer can still see their order. So only
 * ids are stored — the orders themselves are re-read from
 * `GET /api/orders/[id]?qrToken=`, which stays the authority on stage and
 * payment status.
 *
 * A *list*, not one id: "Order something else" is a normal thing to do
 * halfway through a meal, and the second order must not bury the first one
 * that's still in the kitchen. Newest first.
 *
 * Keyed per table token, because one phone can legitimately hold orders from
 * two different cafes (or two visits) and neither should clobber the other.
 *
 * Storage is best-effort throughout: Safari private mode throws on write,
 * some in-app browsers disable it entirely, and a customer who loses the
 * tracker is no worse off than before this existed. Never let it throw into
 * the order flow.
 */
const KEY_PREFIX = "orderly.tracked-order.";

/** Past this, a saved id is almost certainly last visit's, not this meal's. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** One table's worth of rounds. Beyond this the oldest is dropped. */
const MAX_TRACKED = 6;

type Saved = { id: string; at: number };

function key(qrToken: string) {
  return KEY_PREFIX + qrToken;
}

function isSaved(v: unknown): v is Saved {
  const s = v as Partial<Saved> | null;
  return !!s && typeof s.id === "string" && typeof s.at === "number";
}

function read(qrToken: string): Saved[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(qrToken));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Tolerates the single-object shape this used to write, so a customer
    // mid-meal when the code shipped doesn't lose the order they're tracking.
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const cutoff = Date.now() - MAX_AGE_MS;
    return list.filter(isSaved).filter((s) => s.at > cutoff);
  } catch {
    return [];
  }
}

function write(qrToken: string, list: Saved[]): void {
  if (typeof window === "undefined") return;
  try {
    if (list.length === 0) window.localStorage.removeItem(key(qrToken));
    else window.localStorage.setItem(key(qrToken), JSON.stringify(list.slice(0, MAX_TRACKED)));
  } catch {
    // Storage blocked or full — the in-memory tracker still works for this
    // page view, which is exactly the old behaviour.
  }
}

/** Newest first. */
export function readSavedOrderIds(qrToken: string): string[] {
  return read(qrToken).map((s) => s.id);
}

export function addSavedOrderId(qrToken: string, id: string): void {
  const rest = read(qrToken).filter((s) => s.id !== id);
  write(qrToken, [{ id, at: Date.now() }, ...rest]);
}

/** Drop one order — it was cancelled, or the server no longer knows it. */
export function removeSavedOrderId(qrToken: string, id: string): void {
  write(
    qrToken,
    read(qrToken).filter((s) => s.id !== id),
  );
}

/** Keep only these ids, in this order. Used after a bulk re-read. */
export function keepSavedOrderIds(qrToken: string, ids: string[]): void {
  const byId = new Map(read(qrToken).map((s) => [s.id, s]));
  write(
    qrToken,
    ids.map((id) => byId.get(id) ?? { id, at: Date.now() }),
  );
}

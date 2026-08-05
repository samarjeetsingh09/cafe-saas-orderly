"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The reconnect-with-backoff plumbing shared by every `GET /api/stream`
 * consumer (`useLiveOrders`, `useMenuAvailability`). Not the sync path
 * itself — each caller still owns its own message handling and state, this
 * just guarantees they all reconnect the same way instead of three
 * hand-rolled copies.
 */
const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 15_000;

export type StreamMessage = { event: string; payload: unknown };

export function useEventStream(streamUrl: string, onMessage: (msg: StreamMessage) => void) {
  const [connected, setConnected] = useState(false);
  const retryRef = useRef(BASE_RETRY_MS);
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let es: EventSource | null = null;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource(streamUrl);

      es!.onopen = () => {
        retryRef.current = BASE_RETRY_MS;
        setConnected(true);
      };

      es!.onmessage = (ev) => {
        if (!ev.data) return;
        try {
          handlerRef.current(JSON.parse(ev.data));
        } catch {
          // malformed frame — ignore, the connection itself is still fine
        }
      };

      es!.onerror = () => {
        es?.close();
        setConnected(false);
        if (stopped) return;
        retryTimer = setTimeout(connect, retryRef.current);
        retryRef.current = Math.min(retryRef.current * 2, MAX_RETRY_MS);
      };
    }

    connect();
    return () => {
      stopped = true;
      es?.close();
      clearTimeout(retryTimer);
    };
  }, [streamUrl]);

  return { connected };
}

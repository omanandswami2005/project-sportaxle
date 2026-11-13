import { useCallback, useEffect, useState } from "react";
import type { Session } from "./types";

const KEY = "sportsaxle.session";

export function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  if (session) localStorage.setItem(KEY, JSON.stringify(session));
  else localStorage.removeItem(KEY);
}

/** The one place that talks to the backend. Throws Error(message) on failure. */
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const session = loadSession();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(session && { Authorization: `Bearer ${session.token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && session) {
    saveSession(null); // expired token
    location.assign("/login");
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => null))?.detail;
    throw new Error(typeof detail === "string" ? detail : "Something went wrong");
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** GET `path` now and every `ms` after; `refresh()` re-fetches immediately. */
export function usePoll<T>(path: string | null, ms = 5000) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!path) return;
    let live = true;
    const load = () =>
      api<T>(path).then(
        (value) => live && (setData(value), setError(undefined)),
        (err: Error) => live && setError(err.message),
      );
    load();
    const timer = setInterval(load, ms);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [path, ms, tick]);

  return { data, error, refresh };
}

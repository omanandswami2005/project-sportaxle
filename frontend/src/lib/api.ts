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

/** The one place that talks to the backend. Throws Error(message) on failure.
 *  `body` is sent as JSON, or as multipart when it is a FormData. */
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const session = loadSession();
  const isForm = body instanceof FormData; // file uploads
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && !isForm && { "Content-Type": "application/json" }),
      ...(session && { Authorization: `Bearer ${session.token}` }),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (res.status === 401 && session && path !== "/auth/login") {
    saveSession(null); // expired token
    location.assign(`${import.meta.env.BASE_URL}login`);
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => null))?.detail;
    throw new Error(typeof detail === "string" ? detail : "Something went wrong");
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** GET `path` now and again `ms` after each answer; `refresh()` re-fetches immediately.
 *  One request at a time, so a slow network never piles requests up, and an answer from before
 *  a refresh is dropped, so the page never steps back to older state. A tab that becomes visible
 *  again fetches at once. */
export function usePoll<T>(path: string | null, ms = 5000) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!path) return;
    let live = true;
    let busy = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = () => {
      if (busy) return;
      busy = true;
      clearTimeout(timer);
      api<T>(path)
        .then(
          (value) => live && (setData(value), setError(undefined)),
          (err: Error) => live && setError(err.message),
        )
        .finally(() => {
          busy = false;
          if (live) timer = setTimeout(load, ms);
        });
    };
    // A background tab's timers are slowed down; catch up as soon as it is visible again.
    const wake = () => document.visibilityState === "visible" && load();
    load();
    document.addEventListener("visibilitychange", wake);
    return () => {
      live = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [path, ms, tick]);

  return { data, error, refresh };
}

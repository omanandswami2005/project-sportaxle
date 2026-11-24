import { useEffect, useState } from "react";
import type { AuctionState } from "./types";

/** Seconds left on the block, counted down locally and smoothly. Every server answer (a poll,
 *  a bid, a reload) re-anchors the count to the server's exact `ms_left`, so it never drifts
 *  more than one poll; the server alone decides when bidding closes. */
export function useSecondsLeft(state: AuctionState | undefined): number | null {
  const ms = state?.ms_left ?? null;
  const [left, setLeft] = useState(ms === null ? null : Math.ceil(ms / 1000));

  useEffect(() => {
    if (ms === null) return setLeft(null);
    const end = performance.now() + ms; // a monotonic clock: the device's wall clock never matters
    const tick = () => setLeft(Math.max(0, Math.ceil((end - performance.now()) / 1000)));
    tick();
    if (state?.paused) return;
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [state, ms]); // a new answer is a new object, even when ms_left looks the same

  return left;
}

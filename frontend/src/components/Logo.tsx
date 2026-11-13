import { useId } from "react";

/** The Sports Axle mark: Data Axle's "X" with a ball at the axle. */
export function Logo({ className = "h-10 w-10", light = false }: { className?: string; light?: boolean }) {
  const mask = useId();
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <mask id={mask}>
          <rect x="-5" y="-5" width="130" height="130" fill="#fff" />
          <circle cx="60" cy="60" r="17" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${mask})`} className={light ? "fill-white" : "fill-ink"}>
        <polygon points="0,0 30,0 75,60 45,60" />
        <polygon points="120,0 90,0 45,60 75,60" />
        <polygon points="75,60 45,60 0,120 30,120" />
        <polygon points="45,60 75,60 120,120 90,120" />
      </g>
      <circle cx="60" cy="60" r="11" className="fill-brand" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      Sports<span className="text-brand">Axle</span>
    </span>
  );
}

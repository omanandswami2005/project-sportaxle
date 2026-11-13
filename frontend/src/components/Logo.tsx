import { useId, type CSSProperties } from "react";

// Each arm of the X and the direction it flies in from when animated.
const ARMS = [
  { points: "0,0 30,0 75,60 45,60", from: [-70, -70] },
  { points: "120,0 90,0 45,60 75,60", from: [70, -70] },
  { points: "75,60 45,60 0,120 30,120", from: [-70, 70] },
  { points: "45,60 75,60 120,120 90,120", from: [70, 70] },
];

/** The Sports Axle mark: Data Axle's "X" with a ball at the axle.
 *  `animated` replays the film's intro: arms fly in, the ball drops and bounces. */
export function Logo(props: { className?: string; light?: boolean; animated?: boolean }) {
  const mask = useId();
  const { className = "h-10 w-10", light = false, animated = false } = props;
  return (
    <svg viewBox="0 0 120 120" className={`overflow-visible ${className}`} aria-hidden="true">
      <defs>
        <mask id={mask}>
          <rect x="-80" y="-80" width="280" height="280" fill="#fff" />
          <circle cx="60" cy="60" r="17" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${mask})`} className={light ? "fill-white" : "fill-ink"}>
        {ARMS.map(({ points, from }, index) => (
          <polygon
            key={points}
            points={points}
            className={animated ? "logo-arm" : undefined}
            style={{ "--tx": `${from[0]}px`, "--ty": `${from[1]}px`, animationDelay: `${index * 125}ms` } as CSSProperties}
          />
        ))}
      </g>
      {animated && [0, 1].map((ring) => (
        <circle key={ring} cx="60" cy="60" r="11" className="logo-ring" style={{ animationDelay: `${1 + ring * 1.4}s` }} />
      ))}
      <circle cx="60" cy="60" r="11" className={`fill-brand ${animated ? "logo-ball" : ""}`} />
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

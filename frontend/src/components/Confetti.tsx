import type { CSSProperties } from "react";

const COLORS = ["#00a0dc", "#ffffff", "#7fcdf1"]; // brand, white, sky

/** A one-shot burst from the centre of the parent. Hidden under reduced motion (index.css). */
export function Confetti({ count = 36, reach = 130, delay = 0 }: { count?: number; reach?: number; delay?: number }) {
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const distance = reach + ((i * 53) % (reach * 0.85));
        const style = {
          "--x": `${Math.round(Math.cos(angle) * distance)}px`,
          "--y": `${Math.round(Math.sin(angle) * distance * 0.8)}px`,
          "--r": `${(i * 137) % 720}deg`,
          background: COLORS[i % 3],
          animationDelay: `${delay + (i % 5) * 0.02}s`,
        } as CSSProperties;
        return <b key={i} className="confetti" style={style} />;
      })}
    </div>
  );
}

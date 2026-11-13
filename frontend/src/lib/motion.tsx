// Small motion helpers shared by the home page. All respect prefers-reduced-motion
// (see the media query at the bottom of index.css).
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";

/** True once the element is at least `threshold` visible; goes false when it leaves unless `once`. */
export function useInView<T extends Element>(threshold = 0.25, once = true) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) observer.disconnect();
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, once]);

  return { ref, inView };
}

/** Fades and slides its children in the first time they scroll into view. */
export function Reveal(props: { children: ReactNode; delay?: number; from?: "up" | "left" | "right"; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  return (
    <div
      ref={ref}
      className={`reveal reveal-${props.from ?? "up"} ${inView ? "is-in" : ""} ${props.className ?? ""}`}
      style={{ transitionDelay: `${props.delay ?? 0}ms` }}
    >
      {props.children}
    </div>
  );
}

/** Counts up to `value` when scrolled into view, and again whenever it changes. */
export function CountUp({ value }: { value: number }) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.5);
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const origin = from.current;
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(origin + (value - origin) * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    });
    return () => cancelAnimationFrame(frame);
  }, [value, inView]);

  return <span ref={ref}>{shown}</span>;
}

/** Tilts in 3D towards the pointer. */
export function Tilt(props: { children: ReactNode; className?: string; style?: CSSProperties; testId?: string }) {
  const move = (event: MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    event.currentTarget.style.setProperty("--ry", `${x * 14}deg`);
    event.currentTarget.style.setProperty("--rx", `${-y * 14}deg`);
  };
  const reset = (event: MouseEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--ry", "0deg");
    event.currentTarget.style.setProperty("--rx", "0deg");
  };
  return (
    <div className={`tilt ${props.className ?? ""}`} style={props.style} data-testid={props.testId} onMouseMove={move} onMouseLeave={reset}>
      {props.children}
    </div>
  );
}

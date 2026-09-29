import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/** Animated number. Renders the final value immediately for reduced-motion users. */
export default function CountUp({ value, format = (n) => Math.round(n).toLocaleString(), duration = 0.85 }) {
  const ref = useRef(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (typeof value !== 'number' || !Number.isFinite(value) || !ref.current) return undefined;
    const el = ref.current;
    if (reduce) { el.textContent = format(value); prev.current = value; return undefined; }
    const controls = animate(prev.current, value, {
      duration, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { el.textContent = format(v); },
      onComplete: () => { prev.current = value; },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  const ok = typeof value === 'number' && Number.isFinite(value);
  return <span ref={ref} className="num">{ok ? format(reduce ? value : 0) : '—'}</span>;
}

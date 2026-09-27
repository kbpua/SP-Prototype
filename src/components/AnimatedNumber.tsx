import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/utils";

export function AnimatedNumber({
  value,
  duration = 700,
  digits = 0,
  className,
}: {
  value: number;
  duration?: number;
  digits?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (value - from) * eased;
      setDisplay(v);
      fromRef.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className ?? "tabular"}>{formatNumber(display, digits)}</span>;
}

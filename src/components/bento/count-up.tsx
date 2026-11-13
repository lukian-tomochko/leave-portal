"use client";

import { animate } from "motion/react";
import { useEffect, useRef } from "react";

// Число, що «набігає» від нуля до значення. Сервер віддає кінцеве значення (його бачать без JS і тести), а в браузері
// до 1.8 с після короткої затримки лічильник стартує з нуля. При reduced-motion і режимі «спокійний» лишається кінцеве.
export function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const still = document.documentElement.dataset.motion === "calm" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      return;
    }
    el.textContent = `${(0).toFixed(decimals)}${suffix}`;
    const controls = animate(0, value, {
      duration: 1.8,
      delay: 0.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        el.textContent = `${latest.toFixed(decimals)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [value, decimals, suffix]);

  return (
    <span ref={ref} className="tabular-nums">
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

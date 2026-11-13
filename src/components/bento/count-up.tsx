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
      duration: 1.2,
      delay: 0.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        el.textContent = `${latest.toFixed(decimals)}${suffix}`;
      },
    });
    // Якщо користувач увімкнув «спокійний» режим чи reduced-motion під час рахунку, зупиняємо його й показуємо кінцеве значення.
    const finish = () => {
      if (document.documentElement.dataset.motion === "calm" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        controls.stop();
        el.textContent = `${value.toFixed(decimals)}${suffix}`;
      }
    };
    const observer = new MutationObserver(finish);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", finish);
    return () => {
      controls.stop();
      observer.disconnect();
      query.removeEventListener("change", finish);
    };
  }, [value, decimals, suffix]);

  return (
    <span ref={ref} className="tabular-nums">
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

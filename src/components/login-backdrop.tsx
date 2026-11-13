"use client";

import { useEffect, useRef } from "react";

// Рухомий фон сторінки входу: поверх загальних плям (Ambient) плавають кольорові кулі різної швидкості, а м'яке сяйво
// повільно наздоганяє курсор. Лише декор (aria-hidden); при reduced-motion і в режимі «спокійний» усе стоїть на місці.
const ORBS = [
  { cls: "left-[8%] top-[18%] size-40 bg-primary/30", duration: "9s", delay: "0s" },
  { cls: "right-[10%] top-[12%] size-56 bg-leave-personal/25", duration: "13s", delay: "-4s" },
  { cls: "left-[14%] bottom-[12%] size-52 bg-leave-family/30", duration: "11s", delay: "-7s" },
  { cls: "right-[16%] bottom-[16%] size-32 bg-primary/25", duration: "7s", delay: "-2s" },
  { cls: "left-[46%] top-[6%] size-24 bg-leave-sick/25", duration: "10s", delay: "-5s" },
];

export function LoginBackdrop() {
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const calm = document.documentElement.dataset.motion === "calm" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (glow.current && !calm) {
        glow.current.style.transform = `translate3d(${event.clientX - 192}px, ${event.clientY - 192}px, 0)`;
      }
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {ORBS.map((orb) => (
        <span
          key={orb.cls}
          className={`absolute animate-float rounded-full blur-2xl ${orb.cls}`}
          style={{ animationDuration: orb.duration, animationDelay: orb.delay }}
        />
      ))}
      <div ref={glow} className="absolute top-0 left-0 size-96 rounded-full bg-primary/20 blur-3xl transition-transform duration-700 ease-soft" />
    </div>
  );
}

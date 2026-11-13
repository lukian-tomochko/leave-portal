"use client";

import { useSyncExternalStore } from "react";

// Чи дозволений рух зараз: не вимкнено системою (prefers-reduced-motion) і не вибрано режим «спокійний» (data-motion на <html>).
// Для JS-анімацій (motion, recharts), які не вимикаються CSS-правилом globals.css. На сервері вважаємо, що рух вимкнено.
const subscribe = (notify: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    query.removeEventListener("change", notify);
    observer.disconnect();
  };
};

const allowed = () => document.documentElement.dataset.motion !== "calm" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useMotionAllowed(): boolean {
  return useSyncExternalStore(subscribe, allowed, () => false);
}

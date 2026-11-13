"use client";

import { MoonIcon, SparklesIcon, SunIcon, WavesIcon } from "lucide-react";

// Перемикачі вигляду в сайдбарі: тема (світла/темна) і режим руху (повний/спокійний). Вибір пишеться на <html>
// (data-theme, data-motion) і в localStorage; початкове значення ставить скрипт у layout до малювання. Підписи
// перемикаються CSS за атрибутом, тому сервер і клієнт рендерять однакову розмітку (без гідратаційних розбіжностей).
const rowClass =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors duration-(--motion-fast) ease-soft outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

function save(key: string, value: string | null) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Сховище може бути недоступне (приватне вікно): вибір тоді діє лише до перезавантаження.
  }
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      className={rowClass}
      onClick={() => {
        const root = document.documentElement;
        const next = root.dataset.theme === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        save("theme", next);
      }}
    >
      <MoonIcon aria-hidden="true" className="size-4 dark:hidden" />
      <SunIcon aria-hidden="true" className="hidden size-4 dark:block" />
      <span className="dark:hidden">Темна тема</span>
      <span className="hidden dark:inline">Світла тема</span>
    </button>
  );
}

export function MotionToggle() {
  return (
    <button
      type="button"
      className={rowClass}
      onClick={() => {
        const root = document.documentElement;
        if (root.dataset.motion === "calm") {
          delete root.dataset.motion;
          save("motion", null);
        } else {
          root.dataset.motion = "calm";
          save("motion", "calm");
        }
      }}
    >
      <WavesIcon aria-hidden="true" className="size-4 in-data-[motion=calm]:hidden" />
      <SparklesIcon aria-hidden="true" className="hidden size-4 in-data-[motion=calm]:block" />
      <span className="in-data-[motion=calm]:hidden">Рух: повний</span>
      <span className="hidden in-data-[motion=calm]:inline">Рух: спокійний</span>
    </button>
  );
}

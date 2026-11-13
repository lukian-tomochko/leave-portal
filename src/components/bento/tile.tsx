"use client";

import { cn } from "@/lib/utils";

// Плитка bento-сітки: поява «bloom» зі стартовою затримкою за номером (index), підсвічування і легкий нахил за курсором.
// hero — темна акцентна плитка (інверсія foreground/background). Рух вимикають reduced-motion і режим «спокійний».
function motionAllowed() {
  return !(document.documentElement.dataset.motion === "calm" || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// Підсвічування й нахил за курсором; interactive={false} вимикає їх (плитки з формами не мають «пливти» під рукою).
function followPointer(event: React.PointerEvent<HTMLDivElement>) {
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
  el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
  if (rect.width < 700 && motionAllowed()) {
    el.style.setProperty("--rx", `${((0.5 - y) * 5).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((x - 0.5) * 6).toFixed(2)}deg`);
  }
}

function resetTilt(event: React.PointerEvent<HTMLDivElement>) {
  event.currentTarget.style.setProperty("--rx", "0deg");
  event.currentTarget.style.setProperty("--ry", "0deg");
}

export function Tile({
  index = 0,
  hero = false,
  interactive = true,
  className,
  style,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "onPointerMove" | "onPointerLeave"> & { index?: number; hero?: boolean; interactive?: boolean }) {
  return (
    <div
      data-slot="tile"
      data-hero={hero}
      className={cn(
        "tile-spot min-w-0 animate-bloom overflow-hidden rounded-3xl border p-5 shadow-tile",
        hero ? "border-transparent bg-foreground text-background" : "border-border bg-card text-card-foreground",
        className,
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms`, ...style }}
      onPointerMove={interactive ? followPointer : undefined}
      onPointerLeave={interactive ? resetTilt : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

// Заголовок плитки: назва ліворуч, дрібна підказка або дія праворуч.
export function TileHeader({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {aside ? <div className="text-xs text-muted-foreground">{aside}</div> : null}
    </div>
  );
}

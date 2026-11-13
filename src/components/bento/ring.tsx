import { cn } from "@/lib/utils";

// Кільце прогресу (баланс): дуга заповнюється CSS-анімацією ring-fill (без JS). Дані дублює текст поруч, тож SVG
// для читачів з екрана — лише role="img" з підписом.
export function Ring({
  percent,
  label,
  size = 104,
  strokeWidth = 8,
  className,
}: {
  percent: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  className?: string; // клас кольору дуги: stroke-leave-sick, stroke-leave-personal…
}) {
  const p = Math.max(0, Math.min(100, percent));
  const sw = (strokeWidth * 36) / size;
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox="0 0 36 36" className="shrink-0 -rotate-90">
      <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth={sw} className="stroke-muted" />
      <circle
        cx="18"
        cy="18"
        r="15.9155"
        fill="none"
        strokeWidth={sw}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${p} ${100 - p}`}
        className={cn("animate-ring-fill", className)}
      />
    </svg>
  );
}

// Півколо-датчик (покриття): та сама ідея, що в Ring, але дуга 180°.
export function Gauge({ percent, label, className }: { percent: number; label: string; className?: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <svg role="img" aria-label={label} viewBox="0 0 120 70" className="mx-auto block w-full max-w-[260px]">
      <path d="M10 62 A50 50 0 0 1 110 62" fill="none" strokeWidth={12} strokeLinecap="round" pathLength={100} className="stroke-muted" />
      <path
        d="M10 62 A50 50 0 0 1 110 62"
        fill="none"
        strokeWidth={12}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${p} ${100 - p}`}
        className={cn("animate-ring-fill", className)}
      />
    </svg>
  );
}

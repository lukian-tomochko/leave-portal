import { cn } from "@/lib/utils";

// Горизонтальна смуга з часток (статуси заявок, типи відпусток). Сегменти виростають зліва по черзі; кожен сегмент — це
// частка, а число й назва завжди є поруч у легенді, тож колір ніколи не єдине джерело змісту.
export function SplitBar({ label, parts }: { label: string; parts: { key: string; value: number; className: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <div role="img" aria-label={label} className="my-3 flex h-3.5 gap-0.5 overflow-hidden rounded-full">
      {parts
        .filter((part) => part.value > 0)
        .map((part, index) => (
          <i
            key={part.key}
            className={cn("block h-full origin-left animate-stack-grow", part.className)}
            style={{ width: `${(part.value / total) * 100}%`, animationDelay: `${550 + index * 120}ms` }}
          />
        ))}
    </div>
  );
}

// Рядок легенди: кольоровий квадрат, назва й число праворуч.
export function LegendRow({ className, label, value }: { className: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className={cn("size-2.5 rounded-sm", className)} />
      {label}
      <span className="ml-auto font-semibold tabular-nums">{value}</span>
    </li>
  );
}

// Підказка діаграми: власний вміст замість inline-стилів recharts, щоб кольори йшли лише з токенів (bg-popover, border-border).
export function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value?: number | string }[]; label?: string | number; unit: string }) {
  const value = payload?.[0]?.value;
  if (!active || value === undefined) {
    return null;
  }
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-tile">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">
        {value} {unit}
      </p>
    </div>
  );
}

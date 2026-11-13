import Link from "next/link";
import { STATUS_LABELS } from "@/lib/leave/messages";
import { RECORD_STATUSES, type RecordStatus } from "@/lib/leave/types";
import { cn } from "@/lib/utils";

// Фільтр «My requests» за статусом: посилання з ?status=, тож він працює без JS і зберігається в адресі. Назви статусів
// англійські, як у вимогах; у чіпі поруч кількість записів.
export function StatusFilter({ active, counts, total }: { active: RecordStatus | null; counts: Record<RecordStatus, number>; total: number }) {
  const chips: { href: string; label: string; count: number; on: boolean }[] = [
    { href: "/leave", label: "Усі", count: total, on: active === null },
    ...RECORD_STATUSES.map((status) => ({ href: `/leave?status=${status}`, label: STATUS_LABELS[status], count: counts[status], on: active === status })),
  ];
  return (
    <nav aria-label="Фільтр за статусом" className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          aria-current={chip.on ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-[transform,background-color,color] duration-(--motion-base) ease-soft hover:-translate-y-0.5",
            chip.on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {chip.label}
          <span className="text-xs tabular-nums opacity-70">{chip.count}</span>
        </Link>
      ))}
    </nav>
  );
}

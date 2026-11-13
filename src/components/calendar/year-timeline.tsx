import { STATUS_FILL } from "@/components/status-badge";
import { MONTHS_UK, dayLabel } from "@/lib/leave/calendar-view";
import type { Closure } from "@/lib/leave/closures";
import { type Absence, daysBetween } from "@/lib/leave/dashboard";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/leave/messages";
import { cn } from "@/lib/utils";

// Стрічка навчального року (з 1 вересня): рядки «Школа», «Ви» і працівники менеджера. Смуги виростають зліва по черзі, лінія
// «Сьогодні» — акцентна. Колір смуги завжди з текстом у title й у легенді; назва закриття й тип записані в самій смузі.
export function YearTimeline({
  year,
  today,
  closures,
  mine,
  team,
}: {
  year: number;
  today: string;
  closures: Closure[];
  mine: Absence[];
  team?: { id: string; name: string; absences: Absence[] }[];
}) {
  const start = `${year}-09-01`;
  const total = daysBetween(start, `${year + 1}-09-01`);
  const pct = (date: string) => Math.max(0, Math.min(100, (daysBetween(start, date) / total) * 100));
  const span = (from: string, to: string) => ({
    left: `${pct(from)}%`,
    width: `${Math.max(Math.min(100 - pct(from), ((daysBetween(from, to) + 1) / total) * 100), 1.1)}%`,
  });

  const monthStarts = Array.from({ length: 12 }, (_, index) => {
    const monthNumber = ((index + 8) % 12) + 1;
    const monthYear = monthNumber >= 9 ? year : year + 1;
    return { label: MONTHS_UK[monthNumber - 1].slice(0, 3), date: `${monthYear}-${String(monthNumber).padStart(2, "0")}-01` };
  });
  const nowPercent = today >= start && today < `${year + 1}-09-01` ? pct(today) : null;

  const rows: { id: string; label: string; bars: React.ReactNode[] }[] = [
    {
      id: "school",
      label: "Школа",
      bars: closures.map((closure, index) => {
        const early = closure.closedFrom !== null;
        return (
          <Bar
            key={`${closure.startsOn}-${closure.name}`}
            index={index}
            style={span(closure.startsOn < start ? start : closure.startsOn, closure.endsOn)}
            className={early ? "bg-fill-awaiting text-primary-foreground" : "hatch border border-border text-muted-foreground"}
            title={`${closure.name}: ${closure.startsOn}${closure.endsOn !== closure.startsOn ? ` – ${closure.endsOn}` : ""}`}
          >
            {early ? "" : closure.name}
          </Bar>
        );
      }),
    },
    { id: "mine", label: "Ви", bars: mine.map((absence, index) => absenceBar(absence, index + 2, span)) },
    ...(team ?? []).map((member, row) => ({
      id: `employee:${member.id}`,
      label: member.name,
      bars: member.absences.map((absence, index) => absenceBar(absence, row + index + 4, span, false)),
    })),
  ];

  return (
    <div role="group" aria-label="Стрічка навчального року" className="overflow-x-auto pb-1">
      <div className="relative min-w-[720px] pt-5">
        <div className="grid grid-cols-[110px_minmax(0,1fr)]">
          <span />
          <div className="relative h-5 text-xs text-muted-foreground">
            {monthStarts.map((month) => (
              <span key={month.date} className="absolute" style={{ left: `${pct(month.date)}%` }}>
                {month.label}
              </span>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.id} className="contents">
              <span className="flex items-center border-t border-border py-2 pr-2 text-xs text-muted-foreground">
                <span className="truncate">{row.label}</span>
              </span>
              <div className="relative h-10 border-t border-border">{row.bars}</div>
            </div>
          ))}
        </div>
        {/* Вертикальні лінії початків місяців і лінія «Сьогодні». */}
        <div aria-hidden="true" className="pointer-events-none absolute top-5 right-0 bottom-0 left-[110px]">
          {monthStarts.map((month) => (
            <span key={month.date} className="absolute top-5 bottom-0 border-l border-dashed border-border" style={{ left: `${pct(month.date)}%` }} />
          ))}
          {nowPercent !== null ? (
            <span className="absolute top-0 bottom-0 w-0.5 bg-primary" style={{ left: `${nowPercent}%` }}>
              <span className="absolute -top-5 -left-3.5 text-[10px] font-bold text-link">Сьогодні</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Bar({
  index,
  className,
  style,
  title,
  children,
}: {
  index: number;
  className: string;
  style: React.CSSProperties;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      title={title}
      className={cn("absolute top-2 h-6 origin-left animate-grow-x overflow-hidden rounded-full px-2 text-[11px] leading-6 whitespace-nowrap", className)}
      style={{ ...style, animationDelay: `${700 + Math.min(index, 12) * 90}ms` }}
    >
      {children}
    </div>
  );
}

function absenceBar(absence: Absence, index: number, span: (from: string, to: string) => { left: string; width: string }, showType = true) {
  const title = `${LEAVE_TYPE_LABELS[absence.leaveType]}, ${STATUS_LABELS[absence.status]}: ${dayLabel(absence.from)}${absence.to !== absence.from ? ` – ${dayLabel(absence.to)}` : ""}`;
  return (
    <Bar key={`${absence.from}-${absence.leaveType}-${absence.status}`} index={index} style={span(absence.from, absence.to)} className={cn(STATUS_FILL[absence.status], "text-primary-foreground")} title={title}>
      {showType && absence.days > 1 ? LEAVE_TYPE_LABELS[absence.leaveType] : ""}
    </Bar>
  );
}

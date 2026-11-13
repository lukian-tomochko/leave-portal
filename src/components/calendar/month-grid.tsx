"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { type DayCell, type DayInfo, WEEKDAYS_UK, dayLabel, monthCells } from "@/lib/leave/calendar-view";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/leave/messages";
import type { RecordStatus } from "@/lib/leave/types";
import { cn } from "@/lib/utils";

// Фон і текст клітинки за статусом власного запису. Колір лише додається: статус і тип завжди написані в панелі дня,
// у підписі кнопки (aria-label) і в легенді під календарем.
const STATUS_CELL: Record<RecordStatus, string> = {
  awaiting_decision: "bg-status-awaiting text-status-awaiting-foreground font-bold",
  approved: "bg-status-approved text-status-approved-foreground font-bold",
  rejected: "bg-status-rejected text-status-rejected-foreground font-bold",
  returned_for_revision: "bg-status-returned text-status-returned-foreground font-bold",
  cancelled: "bg-status-cancelled text-status-cancelled-foreground line-through",
};

function closureText(closure: NonNullable<DayInfo["closure"]>): string {
  return closure.early ? `скорочений день: ${closure.name}` : `школа закрита: ${closure.name}`;
}

// Підпис клітинки для читачів з екрана й title: дата, закриття, записи, кількість відсутніх.
function describe(date: string, info: DayInfo | undefined): string {
  const parts = [dayLabel(date)];
  if (info?.closure) {
    parts.push(closureText(info.closure));
  }
  parts.push(...(info?.mine ?? []).map((record) => `${LEAVE_TYPE_LABELS[record.leaveType]}, ${STATUS_LABELS[record.status]}`));
  if (info?.away?.length) {
    parts.push(`відсутні: ${info.away.length}`);
  }
  return parts.join(". ");
}

function cellClass(cell: DayCell, info: DayInfo | undefined, flags: { today: boolean; selected: boolean; interactive: boolean; compact: boolean }): string {
  const first = info?.mine?.[0];
  const closedAllDay = info?.closure && !info.closure.early;
  return cn(
    "relative grid place-items-center rounded-xl text-sm font-medium transition-[transform,background-color,box-shadow] duration-(--motion-fast) ease-soft outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    flags.compact ? "h-8" : "h-12",
    cell.weekend ? "text-muted-foreground" : "bg-muted text-foreground",
    closedAllDay && "hatch text-muted-foreground",
    info?.closure?.early && "border-b-4 border-fill-awaiting",
    first && STATUS_CELL[first.status],
    flags.interactive && "hover:z-10 hover:scale-110",
    flags.selected && "ring-2 ring-foreground",
    flags.today && "outline-2 outline-offset-1 outline-primary",
  );
}

function DayContent({ cell, info, today }: { cell: DayCell; info: DayInfo | undefined; today: boolean }) {
  return (
    <>
      {cell.day}
      {today ? <span aria-hidden="true" className="absolute inset-0 animate-ping-soft rounded-xl border-2 border-primary" /> : null}
      {info?.away?.length ? (
        <span aria-hidden="true" className="absolute top-0.5 right-1.5 text-[10px] font-semibold text-muted-foreground">
          {info.away.length}
        </span>
      ) : null}
    </>
  );
}

function DayDetails({ date, info }: { date: string; info: DayInfo | undefined }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">{dayLabel(date)}</p>
      {info?.closure ? (
        <p className="text-muted-foreground">
          {info.closure.early ? "Скорочений день" : "Школа закрита"}: {info.closure.name} ({info.closure.text})
        </p>
      ) : null}
      {info?.mine?.map((record, index) => (
        <p key={index} className="flex flex-wrap items-center gap-2">
          <span>{LEAVE_TYPE_LABELS[record.leaveType]}</span>
          <StatusBadge status={record.status} />
        </p>
      ))}
      {info?.away?.length ? (
        <p className="text-muted-foreground">Відсутні: {info.away.map((entry) => `${entry.name} (${STATUS_LABELS[entry.status]})`).join(", ")}</p>
      ) : null}
      {info ? null : <p className="text-muted-foreground">Звичайний навчальний день, записів немає.</p>}
    </div>
  );
}

// Місячна сітка: закриття (штриховка), власні записи (колір статусу), відсутні працівники (число), пульс на «сьогодні».
// interactive: клік по дню відкриває панель з деталями; compact — мініатюра для головної без панелі.
export function MonthGrid({
  month,
  today,
  days,
  interactive = true,
  compact = false,
}: {
  month: string;
  today: string;
  days: Record<string, DayInfo>;
  interactive?: boolean;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(today.startsWith(month) ? today : null);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS_UK.map((weekday) => (
          <div key={weekday} className="py-1 text-center text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            {weekday}
          </div>
        ))}
        {monthCells(month).map((cell, index) => {
          if (!cell) {
            return <span key={`blank-${index}`} aria-hidden="true" />;
          }
          const info = days[cell.date];
          const isToday = cell.date === today;
          const className = cellClass(cell, info, { today: isToday, selected: cell.date === selected, interactive, compact });
          return interactive ? (
            <button
              key={cell.date}
              type="button"
              aria-label={describe(cell.date, info)}
              aria-pressed={cell.date === selected}
              className={className}
              onClick={() => setSelected(cell.date)}
            >
              <DayContent cell={cell} info={info} today={isToday} />
            </button>
          ) : (
            <div key={cell.date} title={describe(cell.date, info)} className={className}>
              <DayContent cell={cell} info={info} today={isToday} />
            </div>
          );
        })}
      </div>

      {interactive ? (
        <div key={selected ?? "none"} aria-live="polite" className="animate-rise rounded-2xl bg-muted p-4 text-sm" data-testid="day-details">
          {selected ? <DayDetails date={selected} info={days[selected]} /> : <p className="text-muted-foreground">Оберіть день, щоб побачити деталі.</p>}
        </div>
      ) : null}
    </div>
  );
}

// Легенда календаря: колір завжди має текстовий підпис.
export function CalendarLegend({ team = false }: { team?: boolean }) {
  const items: { label: string; className: string }[] = [
    { label: "Awaiting decision", className: "bg-fill-awaiting" },
    { label: "Approved", className: "bg-fill-approved" },
    { label: "Rejected", className: "bg-fill-rejected" },
    { label: "Returned for revision", className: "bg-fill-returned" },
    { label: "Cancelled", className: "bg-fill-cancelled" },
    { label: "Школа закрита", className: "hatch border border-border" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Легенда">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-2.5 rounded-sm", item.className)} />
          {item.label}
        </li>
      ))}
      {team ? <li>Число в куті дня — скільки працівників відсутні</li> : null}
    </ul>
  );
}

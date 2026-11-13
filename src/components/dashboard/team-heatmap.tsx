import { WEEKDAYS_UK, dayLabel } from "@/lib/leave/calendar-view";
import type { HeatCell, TeamOverview } from "@/lib/leave/dashboard";
import { weekdayOf } from "@/lib/leave/time";
import { cn } from "@/lib/utils";

const MAX_ROWS = 8;

const CELL_CLASS: Record<string, string> = {
  approved: "bg-fill-approved",
  awaiting: "bg-fill-awaiting",
  closed: "hatch",
};

const CELL_TEXT: Record<string, string> = {
  approved: ": Approved",
  awaiting: ": Awaiting decision",
  closed: ": школа закрита",
};

const cellClass = (cell: HeatCell) => (cell ? CELL_CLASS[cell] : "bg-muted");
const cellText = (cell: HeatCell) => (cell ? CELL_TEXT[cell] : "");

// Теплова карта «хто відсутній»: рядок — працівник, колонка — робочий день, клітинки виринають по черзі. Колір дублює
// title («Approved», «Awaiting decision», «школа закрита») і легенда внизу.
export function TeamHeatmap({ overview, today }: { overview: TeamOverview; today: string }) {
  const rows = overview.rows.slice(0, MAX_ROWS);
  return (
    <>
      <div className="grid grid-cols-[110px_repeat(15,minmax(0,1fr))] items-center gap-1 text-xs">
        <span />
        {overview.days.map((date) => (
          <span key={date} className="text-center text-[10px] leading-tight text-muted-foreground">
            {Number(date.slice(8, 10))}
            <br />
            {WEEKDAYS_UK[weekdayOf(date) - 1]}
          </span>
        ))}
        {rows.map((row, rowIndex) => (
          <div key={row.member.id} className="contents">
            <span className="truncate pr-2 text-muted-foreground">{row.member.name}</span>
            {row.cells.map((cell, cellIndex) => {
              const date = overview.days[cellIndex] ?? today;
              return (
                <span
                  key={date}
                  title={`${row.member.name}, ${dayLabel(date)}${cellText(cell)}`}
                  className={cn("h-6 animate-pop rounded-md", cellClass(cell), date === today && "outline-2 outline-primary")}
                  style={{ animationDelay: `${700 + (rowIndex * 15 + cellIndex) * 16}ms` }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Легенда">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-fill-approved" />
          Approved
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-fill-awaiting" />
          Awaiting decision
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="hatch size-2.5 rounded-sm border border-border" />
          Школа закрита
        </li>
        {overview.rows.length > MAX_ROWS ? <li>Показано {MAX_ROWS} із {overview.rows.length} працівників</li> : null}
      </ul>
    </>
  );
}

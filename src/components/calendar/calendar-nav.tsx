import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { listItemCard } from "@/components/ui/card";
import { schoolYearLabel } from "@/lib/leave/balance";
import { type CalendarView, monthLabel, shiftMonth } from "@/lib/leave/calendar-view";
import { type Closure, describeClosure } from "@/lib/leave/closures";
import { noClosuresInYear } from "@/lib/leave/messages";
import { cn } from "@/lib/utils";

const navButton = buttonVariants({ variant: "outline", size: "sm" });
const monthHref = (month: string) => `/calendar?view=month&month=${month}`;
const yearHref = (year: number) => `/calendar?view=year&year=${year}`;

function Stepper({ label, title, prev, next, prevLabel, nextLabel }: { label: string; title: string; prev: string; next: string; prevLabel: string; nextLabel: string }) {
  return (
    <nav aria-label={label} className="flex items-center gap-2">
      <Link href={prev} className={navButton} aria-label={prevLabel}>
        ←
      </Link>
      <h2 className="min-w-40 text-center font-display text-xl font-bold tracking-tight">{title}</h2>
      <Link href={next} className={navButton} aria-label={nextLabel}>
        →
      </Link>
    </nav>
  );
}

function ViewLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-4 py-1.5 transition-colors duration-(--motion-base)",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

// Шапка плитки календаря: крок місяця (або навчального року) ліворуч, перемикач «Місяць / Навчальний рік» праворуч.
export function CalendarNav({ view, month, year }: { view: CalendarView; month: string; year: number }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      {view === "month" ? (
        <Stepper
          label="Місяць"
          title={monthLabel(month)}
          prev={monthHref(shiftMonth(month, -1))}
          next={monthHref(shiftMonth(month, 1))}
          prevLabel="Попередній місяць"
          nextLabel="Наступний місяць"
        />
      ) : (
        <Stepper
          label="Рік стрічки"
          title={`Рік ${schoolYearLabel(year)}`}
          prev={yearHref(year - 1)}
          next={yearHref(year + 1)}
          prevLabel="Попередній навчальний рік"
          nextLabel="Наступний навчальний рік"
        />
      )}
      <nav aria-label="Вигляд" className="flex gap-1 rounded-full bg-muted p-1 text-sm font-medium">
        <ViewLink href={monthHref(month)} active={view === "month"}>
          Місяць
        </ViewLink>
        <ViewLink href={yearHref(year)} active={view === "year"}>
          Навчальний рік
        </ViewLink>
      </nav>
    </div>
  );
}

// Список закриттів навчального року з перемикачем років. Тестові селектори (calendar-closures, calendar-empty) і
// тексти лишаються тими, що перевіряє e2e (AC-CAL-02).
export function ClosuresList({ year, closures }: { year: number; closures: Closure[] }) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold tracking-tight tabular-nums">Навчальний рік {schoolYearLabel(year)}</h2>
        <nav aria-label="Навчальний рік" className="flex items-center gap-2">
          <Link href={`/calendar?year=${year - 1}`} className={navButton}>
            ← {schoolYearLabel(year - 1)}
          </Link>
          <Link href={`/calendar?year=${year + 1}`} className={navButton}>
            {schoolYearLabel(year + 1)} →
          </Link>
        </nav>
      </div>
      {closures.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="calendar-empty">
          {noClosuresInYear(year)}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm" data-testid="calendar-closures">
          {closures.map((closure, index) => (
            <li
              key={`${closure.startsOn}-${closure.name}`}
              className={`flex animate-rise flex-wrap items-center justify-between gap-2 p-3 ${listItemCard}`}
              style={{ animationDelay: `${Math.min(index, 8) * 60 + 300}ms` }}
            >
              <span className="font-medium">{closure.name}</span>
              <span className="text-muted-foreground tabular-nums">{describeClosure(closure)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { type Closure, closuresInSchoolYear, describeClosure, parseSchoolYear } from "@/lib/leave/closures";
import { schoolYearLabel, schoolYearOf } from "@/lib/leave/balance";
import { noClosuresInYear } from "@/lib/leave/messages";
import { todayInKyiv, trimSeconds } from "@/lib/leave/time";
import { createClient } from "@/lib/supabase/server";

// «Шкільний календар»: закриття навчального року (цілі дні й скорочені дні). Бачать усі авторизовані (AC-CAL-02);
// гостя перенаправляє на /login без даних (AC-CAL-14: proxy і перевірка тут). Читання йде клієнтом користувача, RLS пускає
// лише authenticated.
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { year: yearParam } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    redirect("/login");
  }

  const year = parseSchoolYear(yearParam, schoolYearOf(todayInKyiv()));
  const { data: rows, error } = await supabase
    .from("school_closures")
    .select("name, starts_on, ends_on, closed_from")
    .lte("starts_on", `${year + 1}-08-31`)
    .gte("ends_on", `${year}-09-01`);
  if (error) {
    throw new Error(`calendar failed: ${error.code ?? "unknown"}`);
  }
  const closures: Closure[] = closuresInSchoolYear(
    (rows ?? []).map((row) => ({
      name: row.name,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      closedFrom: row.closed_from === null ? null : trimSeconds(row.closed_from),
    })),
    year,
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Шкільний календар</h1>
      <nav aria-label="Навчальний рік" className="flex items-center justify-between gap-2">
        <Link href={`/calendar?year=${year - 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          ← {schoolYearLabel(year - 1)}
        </Link>
        <h2 className="text-lg font-semibold tabular-nums">{schoolYearLabel(year)}</h2>
        <Link href={`/calendar?year=${year + 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {schoolYearLabel(year + 1)} →
        </Link>
      </nav>

      {closures.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="calendar-empty">
          {noClosuresInYear(year)}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm" data-testid="calendar-closures">
          {closures.map((closure) => (
            <li
              key={`${closure.startsOn}-${closure.name}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3"
            >
              <span className="font-medium">{closure.name}</span>
              <span className="tabular-nums text-muted-foreground">{describeClosure(closure)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

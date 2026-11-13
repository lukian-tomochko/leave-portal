import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/bento/page-header";
import { Tile } from "@/components/bento/tile";
import { CalendarNav, ClosuresList } from "@/components/calendar/calendar-nav";
import { CalendarLegend, MonthGrid } from "@/components/calendar/month-grid";
import { YearTimeline } from "@/components/calendar/year-timeline";
import { buttonVariants } from "@/components/ui/button";
import { buildDayMap, resolveCalendar } from "@/lib/leave/calendar-view";
import { closuresInSchoolYear } from "@/lib/leave/closures";
import { groupAbsences } from "@/lib/leave/dashboard";
import { isDecider } from "@/lib/leave/decision";
import { loadClosures, loadTeam } from "@/lib/leave/supabase-dashboard-repository";
import { getActor } from "@/lib/supabase/session";
import { createSupabaseLeaveRepository } from "@/lib/leave/supabase-repository";
import { todayInKyiv } from "@/lib/leave/time";
import { listMyRecords } from "@/lib/leave/use-cases";
import { createClient } from "@/lib/supabase/server";

const PENDING_OR_APPROVED = ["approved", "awaiting_decision"];

// «Шкільний календар»: місячна сітка (закриття, власні записи, для менеджера — відсутні працівники), стрічка навчального року
// і список закриттів. Бачать усі авторизовані (AC-CAL-02); гостя перенаправляє на /login без даних (AC-CAL-14: proxy і перевірка
// тут). Читання йде клієнтом користувача, RLS пускає лише authenticated, а команду бачить лише менеджер чи адміністратор.
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }
  const today = todayInKyiv();
  const { year, month, view } = resolveCalendar(await searchParams, today);
  const actor = await getActor(userId);
  const deciding = actor !== null && isDecider(actor.role);

  const [allClosures, records, teamData] = await Promise.all([
    loadClosures(supabase, year),
    listMyRecords(createSupabaseLeaveRepository(supabase), userId),
    actor && deciding ? loadTeam(supabase, actor, year) : Promise.resolve({ team: [], records: [] }),
  ]);
  const closures = closuresInSchoolYear(allClosures, year);

  const mine = records.map((record) => ({ date: record.date, status: record.status, leaveType: record.leaveType }));
  const teamActive = teamData.records.filter((record) => PENDING_OR_APPROVED.includes(record.status) && record.date <= `${year + 1}-08-31`);
  const nameOf = new Map(teamData.team.map((member) => [member.id, member.name]));
  const dayMap = buildDayMap({
    month,
    closures,
    mine,
    team: teamActive.flatMap((record) => {
      const name = nameOf.get(record.employeeId);
      return name ? [{ employeeId: record.employeeId, name, date: record.date, status: record.status }] : [];
    }),
  });
  const teamRows = teamData.team.map((member) => ({
    id: member.id,
    name: member.name,
    absences: groupAbsences(teamActive.filter((record) => record.employeeId === member.id)),
  }));

  return (
    <main className="flex flex-1 flex-col gap-4 py-2">
      <PageHeader
        title="School calendar"
        description="School closures, your leave and the team in one place."
        actions={
          actor?.role === "admin" ? (
            <Link href="/calendar/manage" className={buttonVariants({ size: "sm" })}>
              Manage calendar
            </Link>
          ) : null
        }
      />

      {/* Список закриттів стоїть праворуч від сітки, а не під нею: UAT знімає лише видиму область (page.screenshot без
          fullPage), і рядок закриття з датами має бути в кадрі. У річному вигляді стрічка займає всю ширину. */}
      <div className="grid grid-cols-12 items-start gap-4">
        <Tile index={0} className={view === "month" ? "col-span-8" : "col-span-12"}>
          <CalendarNav view={view} month={month} year={year} />
          <div className="flex flex-col gap-4">
            {view === "month" ? (
              <MonthGrid month={month} today={today} days={dayMap} />
            ) : (
              <YearTimeline
                year={year}
                today={today}
                closures={closures}
                mine={groupAbsences(mine.filter((record) => record.status !== "cancelled" && record.date >= `${year}-09-01` && record.date <= `${year + 1}-08-31`))}
                team={deciding ? teamRows : undefined}
              />
            )}
            <CalendarLegend team={deciding && view === "month"} />
          </div>
        </Tile>

        <Tile index={1} className={view === "month" ? "col-span-4" : "col-span-12"}>
          <ClosuresList year={year} closures={closures} />
        </Tile>
      </div>
    </main>
  );
}

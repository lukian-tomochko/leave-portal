import { redirect } from "next/navigation";
import { PageHeader } from "@/components/bento/page-header";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";
import { balancesOn, schoolYearOf } from "@/lib/leave/balance";
import { buildTeamOverview, daysBetween } from "@/lib/leave/dashboard";
import { isDecider, listAwaiting } from "@/lib/leave/decision";
import { loadBalanceInputs } from "@/lib/leave/supabase-balance-repository";
import { loadClosures, loadTeam } from "@/lib/leave/supabase-dashboard-repository";
import { createSupabaseDecisionRepository } from "@/lib/leave/supabase-decision-repository";
import { createSupabaseLeaveRepository } from "@/lib/leave/supabase-repository";
import { todayInKyiv } from "@/lib/leave/time";
import { listMyRecords } from "@/lib/leave/use-cases";
import { createClient } from "@/lib/supabase/server";
import { getActor, getAwaitingCount, getClaims, getProfile } from "@/lib/supabase/session";

// Головна: дашборд за роллю. Працівник бачить власні баланси, статуси й календар; менеджер і адміністратор — ще й команду
// (хто відсутній, покриття, черга рішень). Сторінка читає cookies, тож рендериться динамічно.
export default async function Home() {
  const claims = await getClaims();
  if (!claims) {
    redirect("/login");
  }

  const supabase = await createClient();
  const today = todayInKyiv();
  const year = schoolYearOf(today);
  // Закриття не залежать від ролі: запит стартує одразу й іде паралельно з профілем і «хто діє» (вони з кешу сесії, спільні з сайдбаром).
  const closuresPromise = loadClosures(supabase, year);
  const [profile, actor] = await Promise.all([getProfile(claims.sub), getActor(claims.sub)]);
  const name = profile?.full_name?.split(" ")[0] ?? "колего";

  if (actor && isDecider(actor.role)) {
    const [closures, { team, records }, awaitingTotal, queuePage] = await Promise.all([
      closuresPromise,
      loadTeam(supabase, actor, year),
      getAwaitingCount(claims.sub),
      listAwaiting(createSupabaseDecisionRepository(supabase), actor),
    ]);
    const overview = buildTeamOverview({ team, records, closures, today });
    const oldest = queuePage.records[0];
    return (
      <main className="flex flex-1 flex-col gap-4 py-2">
        <PageHeader title={`Привіт, ${name}`} description="Команда на найближчі тижні й заявки, що чекають на рішення." />
        <ManagerDashboard
          today={today}
          role={actor.role === "admin" ? "admin" : "manager"}
          overview={overview}
          awaitingTotal={awaitingTotal}
          queue={queuePage.records.slice(0, 3)}
          oldestWaitDays={oldest ? Math.max(0, daysBetween(today, oldest.date)) : null}
        />
      </main>
    );
  }

  const [closures, records, balanceInputs] = await Promise.all([
    closuresPromise,
    listMyRecords(createSupabaseLeaveRepository(supabase), claims.sub),
    loadBalanceInputs(supabase, claims.sub),
  ]);
  return (
    <main className="flex flex-1 flex-col gap-4 py-2">
      <PageHeader title="Головна" description={`Доброго дня, ${name}. Ось ваш навчальний рік.`} />
      <EmployeeDashboard today={today} records={records} balances={balancesOn(balanceInputs, today)} closures={closures} />
    </main>
  );
}

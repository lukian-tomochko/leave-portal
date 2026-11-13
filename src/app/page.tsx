import { redirect } from "next/navigation";
import { PageHeader } from "@/components/bento/page-header";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";
import { balancesOn, schoolYearOf } from "@/lib/leave/balance";
import { buildTeamOverview, daysBetween } from "@/lib/leave/dashboard";
import { isDecider, listAwaiting } from "@/lib/leave/decision";
import { loadBalanceInputs } from "@/lib/leave/supabase-balance-repository";
import { loadClosures, loadTeam } from "@/lib/leave/supabase-dashboard-repository";
import { countAwaiting, createSupabaseDecisionRepository, loadActor } from "@/lib/leave/supabase-decision-repository";
import { createSupabaseLeaveRepository } from "@/lib/leave/supabase-repository";
import { todayInKyiv } from "@/lib/leave/time";
import { listMyRecords } from "@/lib/leave/use-cases";
import { createClient } from "@/lib/supabase/server";

// Головна: дашборд за роллю. Працівник бачить власні баланси, статуси й календар; менеджер і адміністратор — ще й команду
// (хто відсутній, покриття, черга рішень). Сторінка читає cookies, тож рендериться динамічно.
export default async function Home() {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  // RLS: користувач бачить лише власний профіль.
  const { data: profile } = await supabase.from("profiles").select("email, full_name, role").eq("id", claims.sub).maybeSingle();
  const actor = await loadActor(supabase, claims.sub);
  const today = todayInKyiv();
  const year = schoolYearOf(today);
  const name = profile?.full_name?.split(" ")[0] ?? "колего";
  const closures = await loadClosures(supabase, year);

  if (actor && isDecider(actor.role)) {
    const decisionRepository = createSupabaseDecisionRepository(supabase);
    const [{ team, records }, awaitingTotal, queuePage] = await Promise.all([
      loadTeam(supabase, actor, year),
      countAwaiting(supabase, actor),
      listAwaiting(decisionRepository, actor),
    ]);
    const overview = buildTeamOverview({ team, records, closures, today });
    const queue = queuePage.records.slice(0, 3);
    const oldest = queuePage.records[0];
    return (
      <main className="flex flex-1 flex-col gap-4 py-2">
        <PageHeader title={`Привіт, ${name}`} description="Команда на найближчі тижні й заявки, що чекають на рішення." />
        <ManagerDashboard
          today={today}
          role={actor.role === "admin" ? "admin" : "manager"}
          overview={overview}
          awaitingTotal={awaitingTotal}
          queue={queue}
          oldestWaitDays={oldest ? Math.max(0, daysBetween(today, oldest.date)) : null}
        />
      </main>
    );
  }

  const [records, balanceInputs] = await Promise.all([
    listMyRecords(createSupabaseLeaveRepository(supabase), claims.sub),
    loadBalanceInputs(supabase, claims.sub),
  ]);
  return (
    <main className="flex flex-1 flex-col gap-4 py-2">
      <PageHeader title="Головна" description="Ваші баланси, заявки й найближчі дати навчального року." />
      <EmployeeDashboard name={name} today={today} records={records} balances={balancesOn(balanceInputs, today)} closures={closures} />
    </main>
  );
}

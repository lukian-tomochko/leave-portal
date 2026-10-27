import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { balancesOn } from "@/lib/leave/balance";
import { isDecider } from "@/lib/leave/decision";
import { loadBalanceInputs } from "@/lib/leave/supabase-balance-repository";
import { loadActor } from "@/lib/leave/supabase-decision-repository";
import { todayInKyiv } from "@/lib/leave/time";
import { createClient } from "@/lib/supabase/server";
import { BalanceView } from "./balance-view";

// «Баланс»: власний баланс для кожного, а менеджер і адміністратор ще й список працівників, чиї баланси вони можуть
// відкрити (менеджер — працівників своїх посад, AC-BALANCE-20). Права остаточно тримає функція бази employee_balance_inputs.
export default async function BalancesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }
  const actor = await loadActor(supabase, userId);
  if (!actor) {
    redirect("/login");
  }

  const balances = balancesOn(await loadBalanceInputs(supabase, userId), todayInKyiv());

  // Працівники, чиї баланси може відкрити менеджер чи адміністратор: за видимими під RLS посадами.
  let employees: { id: string; name: string }[] = [];
  if (isDecider(actor.role)) {
    const { data: positions, error: positionsError } = await supabase.from("positions").select("employee_id");
    if (positionsError) {
      throw new Error(`balances(positions) failed: ${positionsError.code}`);
    }
    const ids = [...new Set((positions ?? []).map((row) => row.employee_id))].filter((id) => id !== userId);
    if (ids.length > 0) {
      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      if (profilesError) {
        throw new Error(`balances(profiles) failed: ${profilesError.code}`);
      }
      employees = (profiles ?? []).map((row) => ({ id: row.id, name: row.full_name ?? row.email ?? "—" }));
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Баланс відпусток</h1>
      <BalanceView balances={balances} />

      {employees.length > 0 ? (
        <section aria-labelledby="employees-title" className="flex flex-col gap-3">
          <h2 id="employees-title" className="text-lg font-semibold">
            Баланси працівників
          </h2>
          <ul className="flex flex-col gap-2 text-sm" data-testid="balance-employees">
            {employees.map((employee) => (
              <li key={employee.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <span>{employee.name}</span>
                <Link href={`/balances/${employee.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Відкрити
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

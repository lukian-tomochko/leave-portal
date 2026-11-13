import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/bento/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BalanceDeniedError, balancesOn } from "@/lib/leave/balance";
import { NOT_ALLOWED, isRecordId } from "@/lib/leave/decision";
import { loadBalanceInputs } from "@/lib/leave/supabase-balance-repository";
import { todayInKyiv } from "@/lib/leave/time";
import { createClient } from "@/lib/supabase/server";
import { BalanceView } from "../balance-view";

// Баланс іншого працівника: його бачить адміністратор і менеджер хоча б однієї посади працівника (AC-BALANCE-20). Решті
// баланс не показуємо (AC-BALANCE-12, AC-BALANCE-13): функція бази відмовляє, а сторінка показує лише відмову без даних.
export default async function EmployeeBalancePage({ params }: PageProps<"/balances/[id]">) {
  const { id } = await params;
  // id з адреси перевіряємо до запиту: не-UUID дав би помилку Postgres (500) замість 404.
  if (!isRecordId(id)) {
    notFound();
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    redirect("/login");
  }

  let balances = null;
  try {
    balances = balancesOn(await loadBalanceInputs(supabase, id), todayInKyiv());
  } catch (error) {
    if (!(error instanceof BalanceDeniedError)) {
      throw error;
    }
  }

  return (
    <main className="flex w-full max-w-3xl flex-1 flex-col gap-4 py-2">
      <Link href="/balances" className="w-fit px-1 text-sm text-muted-foreground underline">
        ← Balances
      </Link>
      <PageHeader title="Employee balance" />
      {balances ? (
        <BalanceView balances={balances} />
      ) : (
        <Alert variant="destructive" data-testid="balance-denied">
          <AlertDescription>{NOT_ALLOWED}</AlertDescription>
        </Alert>
      )}
    </main>
  );
}

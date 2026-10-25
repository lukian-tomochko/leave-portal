import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { NOT_ALLOWED, isDecider, listHistory } from "@/lib/leave/decision";
import { createSupabaseDecisionRepository, loadActor } from "@/lib/leave/supabase-decision-repository";
import { createClient } from "@/lib/supabase/server";
import { RecordsTable } from "../records-table";

// «History»: записи тих самих посад, які вже не чекають рішення (AC-DECIDE-11).
export default async function HistoryPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const actor = await loadActor(supabase, userId);
  if (!actor || !isDecider(actor.role)) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold">History</h1>
        <Alert variant="destructive">
          <AlertDescription>{NOT_ALLOWED}</AlertDescription>
        </Alert>
      </main>
    );
  }

  const records = await listHistory(createSupabaseDecisionRepository(supabase), actor);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">History</h1>
      <div className="flex gap-2">
        <Link href="/decisions" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Awaiting decision
        </Link>
        <Link href="/decisions/history" className={buttonVariants({ size: "sm" })} aria-current="page">
          History
        </Link>
      </div>
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">Рішень ще немає.</p>
      ) : (
        <RecordsTable records={records} testId="history-records" />
      )}
    </main>
  );
}

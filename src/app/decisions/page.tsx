import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { NOT_ALLOWED, awaitingEmptyMessage, isDecider, listAwaiting, parsePage } from "@/lib/leave/decision";
import { createSupabaseDecisionRepository, loadActor } from "@/lib/leave/supabase-decision-repository";
import { createClient } from "@/lib/supabase/server";
import { Pager } from "./pager";
import { RecordsTable } from "./records-table";

// «Awaiting decision»: записи посад, за які відповідає менеджер (адміністратор бачить усі). Сторінка читає cookies,
// тож рендериться динамічно. Перевірка ролі тут і в дії; права на дані остаточно тримає RLS.
export default async function AwaitingDecisionPage({ searchParams }: PageProps<"/decisions">) {
  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
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
        <h1 className="text-2xl font-semibold">Awaiting decision</h1>
        <Alert variant="destructive">
          <AlertDescription>{NOT_ALLOWED}</AlertDescription>
        </Alert>
      </main>
    );
  }

  const { records, hasNext } = await listAwaiting(createSupabaseDecisionRepository(supabase), actor, page);
  const empty = page === 1 ? awaitingEmptyMessage(records) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Awaiting decision</h1>
      <div className="flex gap-2">
        <Link href="/decisions" className={buttonVariants({ size: "sm" })} aria-current="page">
          Awaiting decision
        </Link>
        <Link href="/decisions/history" className={buttonVariants({ variant: "outline", size: "sm" })}>
          History
        </Link>
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground" data-testid="awaiting-empty">
          {empty}
        </p>
      ) : (
        <>
          <RecordsTable records={records} testId="awaiting-records" />
          <Pager basePath="/decisions" page={page} hasNext={hasNext} />
        </>
      )}
    </main>
  );
}

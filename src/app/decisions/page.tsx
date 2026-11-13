import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/bento/page-header";
import { Tile } from "@/components/bento/tile";
import { buttonVariants } from "@/components/ui/button";
import { awaitingEmptyMessage, isDecider, listAwaiting, parsePage } from "@/lib/leave/decision";
import { createSupabaseDecisionRepository, loadActor } from "@/lib/leave/supabase-decision-repository";
import { createClient } from "@/lib/supabase/server";
import { NotAllowed } from "./not-allowed";
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
    return <NotAllowed title="Awaiting decision" />;
  }

  const { records, hasNext } = await listAwaiting(createSupabaseDecisionRepository(supabase), actor, page);
  const empty = page === 1 ? awaitingEmptyMessage(records) : null;

  return (
    <main className="flex flex-1 flex-col gap-4 py-2">
      <PageHeader title="Awaiting decision" />
      <div className="flex gap-2 px-1">
        <Link href="/decisions" className={buttonVariants({ size: "sm" })} aria-current="page">
          Awaiting decision
        </Link>
        <Link href="/decisions/history" className={buttonVariants({ variant: "outline", size: "sm" })}>
          History
        </Link>
      </div>
      {empty ? (
        <Tile index={0}>
          <p className="py-6 text-center text-sm text-muted-foreground" data-testid="awaiting-empty">
            {empty}
          </p>
        </Tile>
      ) : (
        <>
          <RecordsTable records={records} testId="awaiting-records" />
          <Pager basePath="/decisions" page={page} hasNext={hasNext} />
        </>
      )}
    </main>
  );
}

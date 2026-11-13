import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/bento/page-header";
import { Tile } from "@/components/bento/tile";
import { buttonVariants } from "@/components/ui/button";
import { isDecider, listHistory, parsePage } from "@/lib/leave/decision";
import { createSupabaseDecisionRepository, loadActor } from "@/lib/leave/supabase-decision-repository";
import { createClient } from "@/lib/supabase/server";
import { NotAllowed } from "../not-allowed";
import { Pager } from "../pager";
import { RecordsTable } from "../records-table";

// «History»: записи тих самих посад, які вже не чекають рішення (AC-DECIDE-11).
export default async function HistoryPage({ searchParams }: PageProps<"/decisions/history">) {
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
    return <NotAllowed title="History" />;
  }

  const { records, hasNext } = await listHistory(createSupabaseDecisionRepository(supabase), actor, page);

  return (
    <main className="flex flex-1 flex-col gap-4 py-2">
      <PageHeader title="History" />
      <div className="flex gap-2 px-1">
        <Link href="/decisions" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Awaiting decision
        </Link>
        <Link href="/decisions/history" className={buttonVariants({ size: "sm" })} aria-current="page">
          History
        </Link>
      </div>
      {records.length === 0 ? (
        <Tile index={0}>
          <p className="py-6 text-center text-sm text-muted-foreground">No decisions yet.</p>
        </Tile>
      ) : (
        <>
          <RecordsTable records={records} testId="history-records" />
          <Pager basePath="/decisions/history" page={page} hasNext={hasNext} />
        </>
      )}
    </main>
  );
}

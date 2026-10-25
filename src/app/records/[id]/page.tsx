import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDecisionLine, getRecord, isDecider } from "@/lib/leave/decision";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/leave/messages";
import { createSupabaseDecisionRepository, loadActor } from "@/lib/leave/supabase-decision-repository";
import type { RecordStatus } from "@/lib/leave/types";
import { createClient } from "@/lib/supabase/server";
import { DecisionForm } from "./decision-form";

const STATUS_VARIANTS = {
  awaiting_decision: "awaiting",
  approved: "approved",
  rejected: "rejected",
  returned_for_revision: "returned",
  cancelled: "cancelled",
} as const satisfies Record<RecordStatus, "awaiting" | "approved" | "rejected" | "returned" | "cancelled">;

// Сторінка запису для власника, відповідального менеджера й адміністратора: деталі, коментар працівника
// (AC-DECIDE-20), історія рішень (AC-DECIDE-15) і форма рішення. Чужий запис RLS не віддає, тож це notFound().
export default async function RecordPage({ params }: PageProps<"/records/[id]">) {
  const { id } = await params;

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

  const record = await getRecord(createSupabaseDecisionRepository(supabase), actor, id);
  if (!record) {
    notFound();
  }

  const canDecide = isDecider(actor.role) && record.status === "awaiting_decision";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <Link href={isDecider(actor.role) ? "/decisions" : "/leave"} className="text-sm text-muted-foreground underline">
        ← Назад
      </Link>
      <h1 className="text-2xl font-semibold">Leave record</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg">
            {record.employeeName}
            <Badge variant={STATUS_VARIANTS[record.status]}>{STATUS_LABELS[record.status]}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Position</dt>
            <dd>{record.positionLabel}</dd>
            <dt className="text-muted-foreground">Date</dt>
            <dd className="tabular-nums">{record.date}</dd>
            <dt className="text-muted-foreground">Hours</dt>
            <dd className="tabular-nums">
              {record.startsAt}–{record.endsAt}
            </dd>
            <dt className="text-muted-foreground">Leave type</dt>
            <dd>{LEAVE_TYPE_LABELS[record.leaveType]}</dd>
            <dt className="text-muted-foreground">Employee&apos;s comment</dt>
            <dd data-testid="employee-comment">{record.requestComment ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <section aria-labelledby="history-title" className="flex flex-col gap-3">
        <h2 id="history-title" className="text-lg font-semibold">
          Decision history
        </h2>
        {record.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Рішень ще немає.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm" data-testid="decision-history">
            {record.entries.map((entry) => (
              <li
                key={`${entry.decidedAt}-${entry.decidedByName}`}
                className="rounded-lg border border-border bg-card p-3 text-card-foreground"
              >
                <p>{formatDecisionLine(entry)}</p>
                {entry.comment ? <p className="text-muted-foreground">{entry.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canDecide ? (
        <section aria-labelledby="decide-title" className="flex flex-col gap-3">
          <h2 id="decide-title" className="text-lg font-semibold">
            Decision
          </h2>
          <DecisionForm recordId={record.id} />
        </section>
      ) : null}
    </main>
  );
}

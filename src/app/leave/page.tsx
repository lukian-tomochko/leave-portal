import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/leave/messages";
import type { RecordStatus } from "@/lib/leave/types";
import { createSupabaseLeaveRepository } from "@/lib/leave/supabase-repository";
import { listMyRecords } from "@/lib/leave/use-cases";
import { createClient } from "@/lib/supabase/server";

// Колір статусу лише додається до тексту (DESIGN.md): сам статус завжди написано словами.
const STATUS_VARIANTS = {
  awaiting_decision: "awaiting",
  approved: "approved",
  rejected: "rejected",
  returned_for_revision: "returned",
  cancelled: "cancelled",
} as const satisfies Record<RecordStatus, "awaiting" | "approved" | "rejected" | "returned" | "cancelled">;

// «My requests»: записи відпустки поточного працівника. Сторінка читає cookies, тож рендериться динамічно.
export default async function MyRequestsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const employeeId = data?.claims?.sub;
  if (!employeeId) {
    redirect("/login");
  }

  // RLS: працівник бачить лише власні записи.
  const records = await listMyRecords(createSupabaseLeaveRepository(supabase), employeeId);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground underline">
        ← Головна
      </Link>
      <h1 className="text-2xl font-semibold">My requests</h1>
      <Link href="/leave/new" className={buttonVariants({ className: "self-start" })}>
        Нова заявка
      </Link>

      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">Заявок ще немає.</p>
      ) : (
        <Table data-testid="my-requests">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Leave type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Comment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="tabular-nums">{record.date}</TableCell>
                <TableCell className="tabular-nums">
                  {record.startsAt}–{record.endsAt}
                </TableCell>
                <TableCell>{record.positionLabel}</TableCell>
                <TableCell>{LEAVE_TYPE_LABELS[record.leaveType]}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[record.status]}>{STATUS_LABELS[record.status]}</Badge>
                </TableCell>
                <TableCell className="whitespace-normal">{record.comment ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}

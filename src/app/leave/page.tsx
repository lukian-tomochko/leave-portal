import Link from "next/link";
import { ViewTransition } from "react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/bento/page-header";
import { Tile } from "@/components/bento/tile";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { RiseRow } from "@/components/bento/rise-row";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeaveTypeIcon } from "@/components/leave-type-icon";
import { statusCounts } from "@/lib/leave/dashboard";
import { LEAVE_TYPE_LABELS } from "@/lib/leave/messages";
import { parseStatusFilter } from "@/lib/leave/status-filter";
import { createSupabaseLeaveRepository } from "@/lib/leave/supabase-repository";
import { listMyRecords } from "@/lib/leave/use-cases";
import { createClient } from "@/lib/supabase/server";
import { StatusFilter } from "./status-filter";

// «My requests»: записи відпустки поточного працівника. Сторінка читає cookies, тож рендериться динамічно.
export default async function MyRequestsPage({ searchParams }: PageProps<"/leave">) {
  const filter = parseStatusFilter((await searchParams).status);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const employeeId = data?.claims?.sub;
  if (!employeeId) {
    redirect("/login");
  }

  // RLS: працівник бачить лише власні записи.
  const all = await listMyRecords(createSupabaseLeaveRepository(supabase), employeeId);
  const records = filter ? all.filter((record) => record.status === filter) : all;

  return (
    <main className="flex flex-1 flex-col gap-4 py-2">
      <Link href="/" className="w-fit px-1 text-sm text-muted-foreground underline">
        ← Головна
      </Link>
      <PageHeader
        title="My requests"
        actions={
          <Link href="/leave/new" className={buttonVariants()}>
            Нова заявка
          </Link>
        }
      />

      {all.length > 0 ? <StatusFilter active={filter} counts={statusCounts(all)} total={all.length} /> : null}

      {records.length === 0 ? (
        <Tile index={0}>
          <p className="py-6 text-center text-sm text-muted-foreground">{all.length === 0 ? "Заявок ще немає." : "Записів із таким статусом немає."}</p>
        </Tile>
      ) : (
        <Tile index={0} className="p-2">
        <Table data-testid="my-requests">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Leave type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Manager comment</TableHead>
              <TableHead>
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record, index) => (
              <RiseRow key={record.id} index={index}>
                <TableCell className="tabular-nums">{record.date}</TableCell>
                <TableCell className="tabular-nums">
                  {record.startsAt}–{record.endsAt}
                </TableCell>
                <TableCell>{record.positionLabel}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-3">
                    <LeaveTypeIcon type={record.leaveType} />
                    {LEAVE_TYPE_LABELS[record.leaveType]}
                  </span>
                </TableCell>
                <TableCell>
                  <ViewTransition name={`status-${record.id}`} share="status-morph" default="none">
                    <StatusBadge status={record.status} />
                  </ViewTransition>
                  {record.split ? (
                    <p className="mt-1 text-xs text-muted-foreground" data-testid="record-split">
                      {record.split}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-normal">{record.comment ?? ""}</TableCell>
                <TableCell className="whitespace-normal" data-testid="manager-comment">
                  {record.managerComment ?? ""}
                </TableCell>
                <TableCell>
                  <Link href={`/records/${record.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Відкрити
                  </Link>
                </TableCell>
              </RiseRow>
            ))}
          </TableBody>
        </Table>
        </Tile>
      )}
    </main>
  );
}

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DecisionRecord } from "@/lib/leave/decision";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/leave/messages";
import type { RecordStatus } from "@/lib/leave/types";

// Колір статусу лише додається до тексту (DESIGN.md): сам статус завжди написано словами.
const STATUS_VARIANTS = {
  awaiting_decision: "awaiting",
  approved: "approved",
  rejected: "rejected",
  returned_for_revision: "returned",
  cancelled: "cancelled",
} as const satisfies Record<RecordStatus, "awaiting" | "approved" | "rejected" | "returned" | "cancelled">;

// Таблиця записів для менеджера: «Awaiting decision» і «History».
export function RecordsTable({ records, testId }: { records: DecisionRecord[]; testId: string }) {
  return (
    <Table data-testid={testId}>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Hours</TableHead>
          <TableHead>Leave type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={record.id}>
            <TableCell>{record.employeeName}</TableCell>
            <TableCell>{record.positionLabel}</TableCell>
            <TableCell className="tabular-nums">{record.date}</TableCell>
            <TableCell className="tabular-nums">
              {record.startsAt}–{record.endsAt}
            </TableCell>
            <TableCell>{LEAVE_TYPE_LABELS[record.leaveType]}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANTS[record.status]}>{STATUS_LABELS[record.status]}</Badge>
            </TableCell>
            <TableCell>
              <Link href={`/records/${record.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Відкрити
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

import Link from "next/link";
import { ViewTransition } from "react";
import { Tile } from "@/components/bento/tile";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { RiseRow } from "@/components/bento/rise-row";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DecisionRecord } from "@/lib/leave/decision";
import { LEAVE_TYPE_LABELS } from "@/lib/leave/messages";

// Таблиця записів для менеджера: «Awaiting decision» і «History».
export function RecordsTable({ records, testId }: { records: DecisionRecord[]; testId: string }) {
  return (
    <Tile index={1} className="p-2">
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
        {records.map((record, index) => (
          <RiseRow key={record.id} index={index}>
            <TableCell>{record.employeeName}</TableCell>
            <TableCell>{record.positionLabel}</TableCell>
            <TableCell className="tabular-nums">{record.date}</TableCell>
            <TableCell className="tabular-nums">
              {record.startsAt}–{record.endsAt}
            </TableCell>
            <TableCell>{LEAVE_TYPE_LABELS[record.leaveType]}</TableCell>
            <TableCell>
              <ViewTransition name={`status-${record.id}`} share="status-morph" default="none">
                <StatusBadge status={record.status} />
              </ViewTransition>
            </TableCell>
            <TableCell>
              <Link href={`/records/${record.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open
              </Link>
            </TableCell>
          </RiseRow>
        ))}
      </TableBody>
    </Table>
    </Tile>
  );
}

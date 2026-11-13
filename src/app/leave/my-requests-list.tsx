"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useState, ViewTransition } from "react";
import { Tile } from "@/components/bento/tile";
import { LeaveTypeIcon } from "@/components/leave-type-icon";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { statusCounts } from "@/lib/leave/dashboard";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/leave/messages";
import { RECORD_STATUSES, type LeaveRecordView, type RecordStatus } from "@/lib/leave/types";
import { useMotionAllowed } from "@/lib/use-motion-allowed";
import { cn } from "@/lib/utils";

const MotionRow = motion.create(TableRow);

type Chip = { key: string; status: RecordStatus | null; label: string; count: number };

// Фільтр без запиту до сервера: усі записи вже на сторінці, тож чіп змінює лише стан у браузері. Адресу синхронізуємо через
// history.replaceState (посилання /leave?status=… відкривається одразу з фільтром).
function Chips({ chips, active, onChoose }: { chips: Chip[]; active: RecordStatus | null; onChoose: (status: RecordStatus | null) => void }) {
  return (
    <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const on = chip.status === active;
        return (
          <button
            key={chip.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChoose(chip.status)}
            className={cn(
              "relative inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium outline-none transition-colors duration-(--motion-base) ease-soft focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "border-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {on ? <motion.span layoutId="status-chip" aria-hidden="true" className="absolute inset-0 rounded-full bg-foreground" transition={{ type: "spring", stiffness: 300, damping: 30 }} /> : null}
            <span className="relative">{chip.label}</span>
            <span className="relative text-xs tabular-nums opacity-70">{chip.count}</span>
          </button>
        );
      })}
    </nav>
  );
}

function RecordRow({ record }: { record: LeaveRecordView }) {
  return (
    <MotionRow layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
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
          Open
        </Link>
      </TableCell>
    </MotionRow>
  );
}

// «My requests»: чіпи-фільтри за статусом і таблиця записів. Рядки плавно з'являються, зникають і переїжджають при зміні фільтра.
export function MyRequestsList({ records, initialFilter }: { records: LeaveRecordView[]; initialFilter: RecordStatus | null }) {
  const [filter, setFilter] = useState<RecordStatus | null>(initialFilter);
  const motionAllowed = useMotionAllowed();
  const counts = statusCounts(records);
  const visible = filter ? records.filter((record) => record.status === filter) : records;
  const chips: Chip[] = [
    { key: "all", status: null, label: "All", count: records.length },
    ...RECORD_STATUSES.map((status) => ({ key: status, status, label: STATUS_LABELS[status], count: counts[status] })),
  ];

  const choose = (status: RecordStatus | null) => {
    setFilter(status);
    window.history.replaceState(null, "", status ? `/leave?status=${status}` : "/leave");
  };

  return (
    <MotionConfig reducedMotion={motionAllowed ? "user" : "always"}>
      <Chips chips={chips} active={filter} onChoose={choose} />
      <Tile index={0} interactive={false} className="p-2">
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No requests with this status.</p>
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
                <TableHead>Manager comment</TableHead>
                <TableHead>
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence initial={false}>
                {visible.map((record) => (
                  <RecordRow key={record.id} record={record} />
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </Tile>
    </MotionConfig>
  );
}

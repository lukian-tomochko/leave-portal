"use client";

import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { dayLabel } from "@/lib/leave/calendar-view";
import { NO_WORKING_HOURS, schoolClosedOn } from "@/lib/leave/messages";
import type { LeaveFormModel } from "./use-leave-form";

export type Remaining = { sick: number; personal: number };

const remainingFor = (leaveType: string, remaining: Remaining): number | null => {
  if (leaveType === "sick") {
    return remaining.sick;
  }
  return leaveType === "personal" ? remaining.personal : null;
};

// Жива чернетка: що вже вибрано, ще до запиту на сервер. Залишок — лише довідка; попередження про перевищення дає сервер у підсумку
// (AC-BALANCE-08). Текстів із вимог PM тут немає.
export function DraftPanel({ form, remaining }: { form: LeaveFormModel; remaining: Remaining }) {
  const { leaveType, mode, startsAt, endsAt, selected } = form.values;
  const typeLabel = form.leaveTypes.find((type) => type.value === leaveType)?.label ?? "";
  const left = remainingFor(leaveType, remaining);
  const sorted = [...form.acceptedDates].sort();
  const hours = mode === "hours" && startsAt && endsAt ? `${startsAt}–${endsAt}` : "Цілий день";
  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="text-sm font-semibold">Чернетка</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">Тип</dt>
        <dd className="text-right font-medium">{typeLabel}</dd>
        <dt className="text-muted-foreground">Днів</dt>
        <dd className="text-right font-medium tabular-nums">{sorted.length}</dd>
        <dt className="text-muted-foreground">Час</dt>
        <dd className="text-right font-medium tabular-nums">{hours}</dd>
        <dt className="text-muted-foreground">Посад</dt>
        <dd className="text-right font-medium tabular-nums">{selected.length}</dd>
        {left === null ? null : (
          <>
            <dt className="text-muted-foreground">Залишок типу</dt>
            <dd className="text-right font-medium tabular-nums">{left.toFixed(2)} дн.</dd>
          </>
        )}
      </dl>
      {sorted.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Вибрані дні">
          {sorted.map((date) => (
            <li key={date} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
              {dayLabel(date)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Оберіть дні в календарі.</p>
      )}
    </div>
  );
}

// Підтвердження: форма відправляє ті самі значення знову, а submitLeaveRequest перевіряє все наново.
function ConfirmForm({ form }: { form: LeaveFormModel }) {
  const values = form.summary?.values;
  if (!values) {
    return null;
  }
  return (
    <form action={form.submitAction} className="flex flex-col gap-3">
      <input type="hidden" name="leaveType" value={values.leaveType} />
      {values.relationship ? <input type="hidden" name="relationship" value={values.relationship} /> : null}
      {values.comment ? <input type="hidden" name="comment" value={values.comment} /> : null}
      {values.dates.map((date) => (
        <input key={date} type="hidden" name="date" value={date} />
      ))}
      {values.positionIds.map((id) => (
        <input key={id} type="hidden" name="positionId" value={id} />
      ))}
      <input type="hidden" name="mode" value={values.hours ? "hours" : "whole-day"} />
      {values.hours ? (
        <>
          <input type="hidden" name="startsAt" value={values.hours.startsAt} />
          <input type="hidden" name="endsAt" value={values.hours.endsAt} />
        </>
      ) : null}
      {form.submit.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{form.submit.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={form.submitPending} aria-busy={form.submitPending}>
          {form.submitPending ? <Spinner /> : null}
          Підтвердити
        </Button>
        <Link href="/leave/new" className={buttonVariants({ variant: "link" })}>
          Скасувати
        </Link>
      </div>
    </form>
  );
}

// Підсумок із сервера (AC-LEAVE-11): тип, коментар, попередження, пропущені дати й рядки записів; нижче форма підтвердження.
export function SummaryPanel({ form }: { form: LeaveFormModel }) {
  const summary = form.summary;
  if (!summary) {
    return null;
  }
  return (
    <section aria-labelledby="summary-title" className="flex animate-rise flex-col gap-3">
      <h2 id="summary-title" className="text-sm font-semibold">
        Підсумок
      </h2>
      <p className="text-sm text-muted-foreground">Тип: {summary.leaveTypeLabel}</p>
      {summary.comment ? <p className="text-sm">Коментар: {summary.comment}</p> : null}
      {summary.warning ? (
        <Alert variant="warning" role="status" data-testid="balance-warning">
          <AlertDescription>{summary.warning}</AlertDescription>
        </Alert>
      ) : null}
      {summary.skippedDates.map((date) => (
        <Alert key={date} variant="warning" role="status">
          <AlertDescription>
            {date}: {NO_WORKING_HOURS}
          </AlertDescription>
        </Alert>
      ))}
      {summary.skippedClosed.map((item) => (
        <Alert key={item.date} variant="warning" role="status">
          <AlertDescription>
            {item.date}: {schoolClosedOn(item.name)}
          </AlertDescription>
        </Alert>
      ))}
      <ul className="flex flex-col gap-2 text-sm" data-testid="summary-lines">
        {summary.lines.map((line, index) => (
          <li
            key={`${line.date}-${line.position}`}
            className="animate-rise rounded-2xl border border-border bg-muted p-3 text-foreground"
            style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
          >
            {line.date}, {line.hours} ({line.duration}), {line.position}: {line.status}
          </li>
        ))}
      </ul>
      <ConfirmForm form={form} />
    </section>
  );
}

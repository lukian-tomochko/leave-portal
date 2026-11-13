"use client";

import { Tile } from "@/components/bento/tile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Closure } from "@/lib/leave/closures";
import { DatePicker } from "./date-picker";
import { ExtraFields, PositionsSection, TimeSection } from "./form-sections";
import { DraftPanel, type Remaining, SummaryPanel } from "./summary-panel";
import { TypeCards } from "./type-cards";
import { type LeaveTypeOption, type PositionOption, useLeaveForm } from "./use-leave-form";

// Форма подання заявки (bento): ліворуч кроки (тип, дати в календарі, посади, час, коментар), праворуч жива чернетка, а після
// «Показати підсумок» — підсумок із сервера й підтвердження. Два кроки й тексти PM незмінні (AC-LEAVE-05, 11, 16…).
export function NewLeaveForm({
  positions,
  leaveTypes,
  closures,
  today,
  remaining,
}: {
  positions: PositionOption[];
  leaveTypes: LeaveTypeOption[];
  closures: Closure[];
  today: string;
  remaining: Remaining;
}) {
  const form = useLeaveForm({ positions, leaveTypes, closures });

  if (positions.length === 0) {
    return <p role="status" className="text-muted-foreground">У вас немає посад, тож подати заявку не можна. Зверніться до адміністратора.</p>;
  }

  const errorMessage = form.localError ?? (form.preview.status === "error" ? form.preview.message : null);

  return (
    <div className="grid grid-cols-12 items-start gap-4">
      <form id="leave-form" onSubmit={form.onPreview} className="col-span-7 flex flex-col gap-4">
        <Tile interactive={false} index={0}>
          <TypeCards form={form} />
        </Tile>
        <Tile interactive={false} index={1}>
          <DatePicker form={form} closures={closures} today={today} />
        </Tile>
        <Tile interactive={false} index={2} className="flex flex-col gap-5">
          <PositionsSection form={form} />
          <TimeSection form={form} />
          <ExtraFields form={form} />
        </Tile>
      </form>

      <div className="sticky top-4 col-span-5 flex flex-col gap-4">
        <Tile interactive={false} index={1} className="flex flex-col gap-4">
          {form.summary ? <SummaryPanel form={form} /> : <DraftPanel form={form} remaining={remaining} />}
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" form="leave-form" disabled={form.pending} aria-busy={form.pending} className="self-start">
            {form.pending ? <Spinner /> : null}
            Показати підсумок
          </Button>
        </Tile>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelLeaveRecord, updateLeaveRecordHours } from "./actions";
import type { RecordActionState } from "./state";

const IDLE: RecordActionState = { status: "idle" };

// Дії власника запису: змінити години (лише години, AC-DECIDE-21) і скасувати. «Cancelled» кінцевий, тому перед
// скасуванням діалог підтвердження. Форма годин не містить дати, посади й типу: змінити їх можна лише новою заявкою.
export function EmployeeActions({ recordId, startsAt, endsAt }: { recordId: string; startsAt: string; endsAt: string }) {
  const [hoursState, hoursAction, hoursPending] = useActionState(updateLeaveRecordHours, IDLE);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelLeaveRecord, IDLE);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <form action={hoursAction} className="flex flex-col gap-3">
        <input type="hidden" name="recordId" value={recordId} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="starts-at">З</Label>
            <Input id="starts-at" name="startsAt" type="time" step={300} required defaultValue={startsAt} className="w-auto" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ends-at">До</Label>
            <Input id="ends-at" name="endsAt" type="time" step={300} required defaultValue={endsAt} className="w-auto" />
          </div>
          <Button type="submit" disabled={hoursPending}>
            Зберегти години
          </Button>
        </div>
        {hoursState.status === "error" ? (
          <Alert variant="destructive">
            <AlertDescription>{hoursState.message}</AlertDescription>
          </Alert>
        ) : null}
      </form>

      <form
        id="cancel-form"
        // Діалог закриваємо в момент відправки: помилку дії видно у формі, а не під оверлеєм.
        action={(formData) => {
          setConfirmOpen(false);
          cancelAction(formData);
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="recordId" value={recordId} />
        {cancelState.status === "error" ? (
          <Alert variant="destructive">
            <AlertDescription>{cancelState.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="button" variant="destructive" className="self-start" disabled={cancelPending} onClick={() => setConfirmOpen(true)}>
          Скасувати запис
        </Button>
      </form>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Скасувати цей запис?</DialogTitle>
            <DialogDescription>Скасований запис не можна повернути в роботу: потрібна нова заявка.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Не скасовувати</DialogClose>
            <Button type="submit" form="cancel-form" variant="destructive" disabled={cancelPending}>
              Скасувати запис
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

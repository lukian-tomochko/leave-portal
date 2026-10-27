"use client";

import { useActionState, useState } from "react";
import { decideLeaveRecord } from "@/app/decisions/actions";
import type { DecisionFormState } from "@/app/decisions/state";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const IDLE: DecisionFormState = { status: "idle" };

// Форма рішення менеджера. Approve і Reject остаточні («Approved» і «Rejected» не скасовуються), тому перед ними
// діалог підтвердження (рішення розробника, PM: issue #17). «Return for revision» вимагає коментаря й відправляється одразу.
export function DecisionForm({ recordId, splitSuggested }: { recordId: string; splitSuggested: boolean }) {
  const [state, formAction, pending] = useActionState(decideLeaveRecord, IDLE);
  // split: схвалення з розподілом (запис "Personal leave" перевищує баланс, AC-BALANCE-10).
  const [confirm, setConfirm] = useState<{ decision: "approved" | "rejected"; split: boolean } | null>(null);

  return (
    <>
      <form
        id="decision-form"
        // Діалог закриваємо в момент відправки: FormData вже зібрано (разом із decision), а помилку дії видно у формі.
        action={(formData) => {
          setConfirm(null);
          formAction(formData);
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="recordId" value={recordId} />
        <input type="hidden" name="split" value={confirm?.split ? "1" : "0"} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="decision-comment">Comment (required to return for revision)</Label>
          <Textarea id="decision-comment" name="comment" rows={3} />
        </div>
        {state.status === "error" ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {splitSuggested ? (
            <Button type="button" disabled={pending} onClick={() => setConfirm({ decision: "approved", split: true })}>
              Approve with the suggested split
            </Button>
          ) : null}
          <Button
            type="button"
            variant={splitSuggested ? "outline" : "default"}
            disabled={pending}
            onClick={() => setConfirm({ decision: "approved", split: false })}
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => setConfirm({ decision: "rejected", split: false })}
          >
            Reject
          </Button>
          <Button type="submit" name="decision" value="returned_for_revision" variant="outline" disabled={pending}>
            Return for revision
          </Button>
        </div>
      </form>

      <Dialog open={confirm !== null} onOpenChange={(open) => (open ? undefined : setConfirm(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.decision === "rejected" ? "Reject this record?" : "Approve this record?"}</DialogTitle>
            <DialogDescription>
              This decision is final: an approved or rejected record cannot be changed back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              type="submit"
              form="decision-form"
              name="decision"
              value={confirm?.decision ?? ""}
              variant={confirm?.decision === "rejected" ? "destructive" : "default"}
              disabled={pending}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

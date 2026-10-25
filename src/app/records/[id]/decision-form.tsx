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
export function DecisionForm({ recordId }: { recordId: string }) {
  const [state, formAction, pending] = useActionState(decideLeaveRecord, IDLE);
  const [confirm, setConfirm] = useState<"approved" | "rejected" | null>(null);

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
          <Button type="button" disabled={pending} onClick={() => setConfirm("approved")}>
            Approve
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => setConfirm("rejected")}>
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
            <DialogTitle>{confirm === "approved" ? "Approve this record?" : "Reject this record?"}</DialogTitle>
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
              value={confirm ?? ""}
              variant={confirm === "rejected" ? "destructive" : "default"}
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

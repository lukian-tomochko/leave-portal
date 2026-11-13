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
import { removeClosure } from "./actions";
import type { ClosureFormState } from "./state";

const IDLE: ClosureFormState = { status: "idle" };

export type ClosureRow = { id: string; name: string; dates: string };

// Список закриттів із видаленням. Видалення остаточне (закриття не редагується: видаляють і додають нове), тому перед ним
// діалог підтвердження, як у рішеннях менеджера.
export function ClosureList({ rows }: { rows: ClosureRow[] }) {
  const [state, formAction, pending] = useActionState(removeClosure, IDLE);
  const [target, setTarget] = useState<ClosureRow | null>(null);

  return (
    <>
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <ul
        className={`flex flex-col gap-2 text-sm transition-opacity duration-(--motion-base) ease-soft ${pending ? "opacity-60" : ""}`}
        aria-busy={pending}
        data-testid="manage-closures"
      >
        {rows.map((row, index) => (
          <li key={row.id} className="flex animate-rise flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-muted p-3" style={{ animationDelay: `${Math.min(index, 8) * 60 + 400}ms` }}>
            <span className="font-medium">{row.name}</span>
            <span className="tabular-nums text-muted-foreground">{row.dates}</span>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setTarget(row)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={target !== null} onOpenChange={(open) => (open ? undefined : setTarget(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete closure “{target?.name}”?</DialogTitle>
            <DialogDescription>
              The days become working days again in schedules. Leave records are not changed. To change a closure, add a new one.
            </DialogDescription>
          </DialogHeader>
          <form
            id="remove-closure-form"
            action={(formData) => {
              setTarget(null);
              formAction(formData);
            }}
          >
            <input type="hidden" name="id" value={target?.id ?? ""} />
          </form>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" form="remove-closure-form" variant="destructive" disabled={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

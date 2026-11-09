"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { FADE_IN } from "@/lib/utils";
import { addClosure } from "./actions";
import type { ClosureFormState } from "./state";

const IDLE: ClosureFormState = { status: "idle" };

// Форма додавання закриття: цілі дні (від дати до дати) або скорочений день (дата й час закриття, крок 5 хвилин).
// Відмови показуємо дослівно з вимог PM (AC-CAL-07, 10, 11); введене лишається у формі.
export function ClosureForm() {
  const [state, formAction, pending] = useActionState(addClosure, IDLE);
  const [kind, setKind] = useState<"whole" | "early">("whole");
  // Після помилки поля беруть введене з стану дії; після успіху (saved) стан без values, і форма порожня.
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4" data-testid="closure-form">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="closure-name">Назва</Label>
        <Input id="closure-name" name="name" required maxLength={100} defaultValue={values?.name} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Тип закриття</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="kind"
            value="whole"
            checked={kind === "whole"}
            onChange={() => setKind("whole")}
            className="size-4 accent-primary"
          />
          Цілі дні
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="kind"
            value="early"
            checked={kind === "early"}
            onChange={() => setKind("early")}
            className="size-4 accent-primary"
          />
          Скорочений день
        </label>
      </fieldset>

      {kind === "whole" ? (
        <div className={`grid gap-4 sm:grid-cols-2 ${FADE_IN}`}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="closure-starts-on">Початкова дата</Label>
            <Input id="closure-starts-on" name="startsOn" type="date" required defaultValue={values?.startsOn} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="closure-ends-on">Кінцева дата</Label>
            <Input id="closure-ends-on" name="endsOn" type="date" required defaultValue={values?.endsOn} />
          </div>
        </div>
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 ${FADE_IN}`}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="closure-date">Дата</Label>
            <Input id="closure-date" name="date" type="date" required defaultValue={values?.date} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="closure-time">Школа закрита від</Label>
            <Input id="closure-time" name="time" type="time" step={300} required defaultValue={values?.time} />
          </div>
        </div>
      )}

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner /> : null}
          Додати закриття
        </Button>
      </div>
    </form>
  );
}

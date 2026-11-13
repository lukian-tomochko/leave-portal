"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { RELATIONSHIPS } from "@/lib/leave/types";
import { cn } from "@/lib/utils";
import type { LeaveFormModel, Mode } from "./use-leave-form";

const CHOICE = "size-4 accent-primary";

export function PositionsSection({ form }: { form: LeaveFormModel }) {
  const { selected } = form.values;
  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="mb-1 text-sm font-semibold">3 · Посади</legend>
      {form.positions.map((position) => (
        <label
          key={position.id}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition-colors duration-(--motion-base)",
            selected.includes(position.id) ? "border-primary bg-primary-soft" : "border-transparent bg-muted",
          )}
        >
          <input type="checkbox" className={CHOICE} checked={selected.includes(position.id)} onChange={(event) => form.togglePosition(position.id, event.target.checked)} />
          {position.label}
        </label>
      ))}
    </fieldset>
  );
}

function ModeOption({ value, current, onSelect, children }: { value: Mode; current: Mode; onSelect: (mode: Mode) => void; children: string }) {
  return (
    <label
      className={cn(
        "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-(--motion-base)",
        current === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <input type="radio" className={CHOICE} name="mode" value={value} checked={current === value} onChange={() => onSelect(value)} />
      {children}
    </label>
  );
}

// «Скільки часу»: цілий день або години в межах розкладу (поля «З» і «До» з кроком 5 хв).
export function TimeSection({ form }: { form: LeaveFormModel }) {
  const { mode, startsAt, endsAt } = form.values;
  return (
    <fieldset className="flex flex-col gap-3 text-sm">
      <legend className="mb-1 text-sm font-semibold">4 · Скільки часу</legend>
      <div className="flex gap-1 rounded-full bg-muted p-1">
        <ModeOption value="whole-day" current={mode} onSelect={form.set.setMode}>
          Цілий день
        </ModeOption>
        <ModeOption value="hours" current={mode} onSelect={form.set.setMode}>
          Години
        </ModeOption>
      </div>
      {mode === "hours" ? (
        <div className="flex animate-rise items-center gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="starts-at">З</Label>
            <Input id="starts-at" type="time" step={300} required value={startsAt} onChange={(event) => form.set.setStartsAt(event.target.value)} className="w-auto" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ends-at">До</Label>
            <Input id="ends-at" type="time" step={300} required value={endsAt} onChange={(event) => form.set.setEndsAt(event.target.value)} className="w-auto" />
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

// Спорідненість (лише для Family) і коментар. Без maxLength: довжину перевіряє сервер і повертає повідомлення PM (AC-LEAVE-18);
// лічильник лише підказує.
export function ExtraFields({ form }: { form: LeaveFormModel }) {
  const { relationship, comment } = form.values;
  return (
    <div className="flex flex-col gap-4">
      {form.isFamily ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="relationship">Спорідненість</Label>
          <NativeSelect id="relationship" value={relationship} onChange={(event) => form.set.setRelationship(event.target.value)}>
            <option value="">—</option>
            {RELATIONSHIPS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="comment">Коментар (необов&apos;язково)</Label>
          <span className="text-xs text-muted-foreground tabular-nums" aria-hidden="true">
            {comment.length}/500
          </span>
        </div>
        <Textarea id="comment" value={comment} onChange={(event) => form.set.setComment(event.target.value)} rows={3} />
      </div>
    </div>
  );
}

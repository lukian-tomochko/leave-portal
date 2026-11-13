"use client";

import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import type { LeaveFormModel } from "./use-leave-form";

const HINTS: Record<string, string> = {
  sick: "Illness",
  personal: "Personal matters",
  unpaid: "Time off without pay",
  family: "Family occasion",
};

// Картки типів відпустки. Справжній вибір тримає прихований select з підписом «Leave type» (його знають тести й читачі з
// екрана); картки лише швидший спосіб змінити його значення. Тип завжди написаний словами.
export function TypeCards({ form }: { form: LeaveFormModel }) {
  const { leaveType } = form.values;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold">1 · Choose a type</legend>
      <div className="grid grid-cols-2 gap-2">
        {form.leaveTypes.map((type) => (
          <button
            key={type.value}
            type="button"
            aria-pressed={leaveType === type.value}
            onClick={() => form.set.setLeaveType(type.value)}
            className={cn(
              "rounded-2xl border-2 p-3 text-left transition-[transform,background-color,border-color] duration-(--motion-base) ease-soft outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
              leaveType === type.value ? "border-primary bg-primary-soft" : "border-transparent bg-muted",
            )}
          >
            <span className="block font-semibold">{type.label}</span>
            <span className="text-xs text-muted-foreground">{HINTS[type.value] ?? ""}</span>
          </button>
        ))}
      </div>
      <div className="sr-only">
        <Label htmlFor="leave-type">Leave type</Label>
        <NativeSelect id="leave-type" value={leaveType} onChange={(event) => form.set.setLeaveType(event.target.value)}>
          {form.leaveTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </NativeSelect>
      </div>
    </fieldset>
  );
}

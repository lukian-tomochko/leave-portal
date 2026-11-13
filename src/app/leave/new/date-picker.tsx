"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAYS, dayLabel, monthCells, monthLabel, shiftMonth } from "@/lib/leave/calendar-view";
import { type Closure, closureOn } from "@/lib/leave/closures";
import { cn } from "@/lib/utils";
import type { LeaveFormModel } from "./use-leave-form";

function DayButton({ date, day, form, closures, today }: { date: string; day: number; form: LeaveFormModel; closures: Closure[]; today: string }) {
  const { dates, anchor } = form.values;
  const picked = dates.includes(date);
  const closed = closureOn(closures, date)?.closedFrom === null;
  const blocked = !picked && form.dateError(date) !== null;
  return (
    <button
      type="button"
      disabled={blocked}
      aria-pressed={picked}
      aria-label={`${dayLabel(date)}${closed ? ", school closed" : ""}`}
      onClick={() => form.pickDay(date)}
      className={cn(
        "relative grid h-10 place-items-center rounded-xl text-sm font-medium outline-none transition-[transform,background-color] duration-(--motion-fast) ease-soft focus-visible:ring-3 focus-visible:ring-ring/50",
        picked ? "bg-primary font-bold text-primary-foreground" : "bg-muted text-foreground hover:scale-105",
        closed && "hatch text-muted-foreground",
        blocked && "cursor-not-allowed opacity-40",
        date === anchor && "ring-2 ring-foreground",
        date === today && !picked && "outline-2 outline-primary",
      )}
    >
      {day}
    </button>
  );
}

// Ручні поля дат («Дата N»): ті самі дати, що в календарі, але з клавіатури; помилки (AC-LEAVE-06, AC-CAL-03) — під полем.
function DateFields({ form }: { form: LeaveFormModel }) {
  const { dates } = form.values;
  const { setDates } = form.set;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {dates.map((date, index) => {
        const error = form.dateError(date);
        return (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Label htmlFor={`date-${index}`} className="w-16 shrink-0">
                Date {index + 1}
              </Label>
              <Input
                id={`date-${index}`}
                type="date"
                value={date}
                required
                aria-invalid={error !== null}
                onChange={(event) => setDates(dates.map((d, i) => (i === index ? event.target.value : d)))}
                className="w-auto"
              />
              {dates.length > 1 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setDates(dates.filter((_, i) => i !== index))}>
                  Remove
                </Button>
              ) : null}
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setDates([...dates, ""])}>
        Add date
      </Button>
    </div>
  );
}

// Календар для вибору дат: клік — день, другий клік — діапазон до цієї дати (лише робочі дні обраних посад). Закриті дні
// заштриховані й недоступні; тут же поля «Дата N» для введення з клавіатури.
export function DatePicker({ form, closures, today }: { form: LeaveFormModel; closures: Closure[]; today: string }) {
  const firstDate = form.values.dates.find((date) => date !== "");
  const [month, setMonth] = useState((firstDate ?? today).slice(0, 7));

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-sm font-semibold">2 · Dates</legend>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
          ←
        </Button>
        <span className="font-display text-lg font-bold tracking-tight">{monthLabel(month)}</span>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
          →
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="text-center text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            {weekday}
          </div>
        ))}
        {monthCells(month).map((cell, index) =>
          cell ? <DayButton key={cell.date} date={cell.date} day={cell.day} form={form} closures={closures} today={today} /> : <span key={`blank-${index}`} aria-hidden="true" />,
        )}
      </div>
      <p className="text-xs text-muted-foreground">Click a day, then another to select a range. You can edit the chosen dates in the fields below.</p>
      <DateFields form={form} />
    </fieldset>
  );
}

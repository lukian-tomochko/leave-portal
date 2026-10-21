"use client";

import Link from "next/link";
import { type FormEvent, useActionState, useState, useTransition } from "react";
import { NO_WORKING_HOURS } from "@/lib/leave/messages";
import { RELATIONSHIPS } from "@/lib/leave/types";
import { weekdayOf } from "@/lib/leave/time";
import { previewLeaveRequest, submitLeaveRequest } from "../actions";
import type { LeaveFormState } from "../state";

type PositionOption = { id: string; label: string; weekdays: number[] };
type LeaveTypeOption = { value: string; label: string };
type Mode = "whole-day" | "hours";

const INPUT_CLASS = "rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
const BUTTON_CLASS = "rounded bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60";
const IDLE: LeaveFormState = { status: "idle" };

// Стабільний ключ значень форми: за ним відрізняємо підсумок для поточних даних від застарілого.
function keyOf(values: {
  leaveType: string;
  dates: string[];
  positionIds: string[];
  mode: Mode;
  startsAt: string;
  endsAt: string;
  relationship: string;
  comment: string;
}) {
  return JSON.stringify({
    ...values,
    dates: [...new Set(values.dates)].sort(),
    positionIds: [...new Set(values.positionIds)].sort(),
  });
}

export function NewLeaveForm({
  positions,
  leaveTypes,
}: {
  positions: PositionOption[];
  leaveTypes: LeaveTypeOption[];
}) {
  const [preview, previewAction, previewPending] = useActionState(previewLeaveRequest, IDLE);
  const [submit, submitAction, submitPending] = useActionState(submitLeaveRequest, IDLE);
  const [isTransition, startTransition] = useTransition();

  // Значення форми тримаємо в стані React, тож вони не скидаються після помилки чи підсумку (AC-LEAVE-11).
  const [dates, setDates] = useState<string[]>([""]);
  const [selected, setSelected] = useState<string[]>(positions.map((position) => position.id));
  const [mode, setMode] = useState<Mode>("whole-day");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [leaveType, setLeaveType] = useState(leaveTypes[0]?.value ?? "");
  const [relationship, setRelationship] = useState("");
  const [comment, setComment] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  if (positions.length === 0) {
    return <p role="status">У вас немає посад, тож подати заявку не можна. Зверніться до адміністратора.</p>;
  }

  // Дату не приймаємо, якщо жодна з обраних посад не має розкладу в цей день тижня (AC-LEAVE-06).
  const dateError = (date: string): string | null => {
    if (!date) {
      return null;
    }
    const weekday = weekdayOf(date);
    const works = positions.some((position) => selected.includes(position.id) && position.weekdays.includes(weekday));
    return works ? null : NO_WORKING_HOURS;
  };

  const acceptedDates = dates.filter((date) => date !== "" && dateError(date) === null);
  const isFamily = leaveType === "family";
  const currentKey = keyOf({
    leaveType,
    dates: acceptedDates,
    positionIds: selected,
    mode,
    startsAt: mode === "hours" ? startsAt : "",
    endsAt: mode === "hours" ? endsAt : "",
    relationship: isFamily ? relationship : "",
    comment: comment.trim(),
  });

  const onPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (acceptedDates.length === 0) {
      setLocalError(dates.map(dateError).find((message) => message !== null) ?? "Оберіть хоча б одну дату.");
      return;
    }
    setLocalError(null);

    const formData = new FormData();
    formData.set("leaveType", leaveType);
    acceptedDates.forEach((date) => formData.append("date", date));
    selected.forEach((id) => formData.append("positionId", id));
    formData.set("mode", mode);
    if (mode === "hours") {
      formData.set("startsAt", startsAt);
      formData.set("endsAt", endsAt);
    }
    if (isFamily) {
      formData.set("relationship", relationship);
    }
    formData.set("comment", comment);
    startTransition(() => {
      previewAction(formData);
    });
  };

  // Підсумок показуємо лише для тих значень, що зараз у формі; після змін він застаріває.
  const summary =
    preview.status === "summary" &&
    keyOf({
      leaveType: preview.values.leaveType,
      dates: preview.values.dates,
      positionIds: preview.values.positionIds,
      mode: preview.values.hours ? "hours" : "whole-day",
      startsAt: preview.values.hours?.startsAt ?? "",
      endsAt: preview.values.hours?.endsAt ?? "",
      relationship: preview.values.relationship ?? "",
      comment: (preview.values.comment ?? "").trim(),
    }) === currentKey
      ? preview
      : null;

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={onPreview} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">Дати відсутності</legend>
          {dates.map((date, index) => {
            const error = dateError(date);
            return (
              <div key={index} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2">
                    <span className="w-16">Дата {index + 1}</span>
                    <input
                      type="date"
                      value={date}
                      required
                      aria-invalid={error !== null}
                      onChange={(event) => setDates(dates.map((d, i) => (i === index ? event.target.value : d)))}
                      className={INPUT_CLASS}
                    />
                  </label>
                  {dates.length > 1 ? (
                    <button type="button" className="text-sm underline" onClick={() => setDates(dates.filter((_, i) => i !== index))}>
                      Прибрати
                    </button>
                  ) : null}
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-red-600">
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}
          <button type="button" className="self-start text-sm underline" onClick={() => setDates([...dates, ""])}>
            Додати дату
          </button>
        </fieldset>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">Посади</legend>
          {positions.map((position) => (
            <label key={position.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(position.id)}
                onChange={(event) =>
                  setSelected(event.target.checked ? [...selected, position.id] : selected.filter((id) => id !== position.id))
                }
              />
              {position.label}
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">Скільки часу</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="whole-day" checked={mode === "whole-day"} onChange={() => setMode("whole-day")} />
            Цілий день
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="hours" checked={mode === "hours"} onChange={() => setMode("hours")} />
            Години
          </label>
          {mode === "hours" ? (
            <div className="flex items-center gap-3">
              <label className="flex flex-col gap-1">
                З
                <input type="time" step={300} required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="flex flex-col gap-1">
                До
                <input type="time" step={300} required value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className={INPUT_CLASS} />
              </label>
            </div>
          ) : null}
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          Тип відпустки
          <select value={leaveType} onChange={(event) => setLeaveType(event.target.value)} className={INPUT_CLASS}>
            {leaveTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        {isFamily ? (
          <label className="flex flex-col gap-1 text-sm">
            Спорідненість
            <select value={relationship} onChange={(event) => setRelationship(event.target.value)} className={INPUT_CLASS}>
              <option value="">—</option>
              {RELATIONSHIPS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {/* Без maxLength: довжину перевіряє сервер і повертає повідомлення PM (AC-LEAVE-18). */}
        <label className="flex flex-col gap-1 text-sm">
          Коментар (необов&apos;язково)
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className={INPUT_CLASS} />
        </label>

        {localError ? (
          <p role="alert" className="text-sm text-red-600">
            {localError}
          </p>
        ) : null}
        {preview.status === "error" ? (
          <p role="alert" className="text-sm text-red-600">
            {preview.message}
          </p>
        ) : null}

        <button type="submit" disabled={previewPending || isTransition} className={`self-start ${BUTTON_CLASS}`}>
          Показати підсумок
        </button>
      </form>

      {summary ? (
        <section aria-labelledby="summary-title" className="flex flex-col gap-4">
          <h2 id="summary-title" className="text-lg font-semibold">
            Підсумок
          </h2>
          <p className="text-sm text-zinc-500">Тип: {summary.leaveTypeLabel}</p>
          {summary.comment ? <p className="text-sm">Коментар: {summary.comment}</p> : null}
          <ul className="flex flex-col gap-2 text-sm" data-testid="summary-lines">
            {summary.lines.map((line) => (
              <li key={`${line.date}-${line.position}`} className="rounded border border-zinc-300 p-3 dark:border-zinc-700">
                {line.date}, {line.hours} ({line.duration}), {line.position}: {line.status}
              </li>
            ))}
          </ul>

          <form action={submitAction} className="flex flex-col gap-3">
            <input type="hidden" name="leaveType" value={summary.values.leaveType} />
            {summary.values.relationship ? <input type="hidden" name="relationship" value={summary.values.relationship} /> : null}
            {summary.values.comment ? <input type="hidden" name="comment" value={summary.values.comment} /> : null}
            {summary.values.dates.map((date) => (
              <input key={date} type="hidden" name="date" value={date} />
            ))}
            {summary.values.positionIds.map((id) => (
              <input key={id} type="hidden" name="positionId" value={id} />
            ))}
            {summary.values.hours ? (
              <>
                <input type="hidden" name="mode" value="hours" />
                <input type="hidden" name="startsAt" value={summary.values.hours.startsAt} />
                <input type="hidden" name="endsAt" value={summary.values.hours.endsAt} />
              </>
            ) : (
              <input type="hidden" name="mode" value="whole-day" />
            )}

            {submit.status === "error" ? (
              <p role="alert" className="text-sm text-red-600">
                {submit.message}
              </p>
            ) : null}

            <div className="flex items-center gap-4">
              <button type="submit" disabled={submitPending} className={BUTTON_CLASS}>
                Підтвердити
              </button>
              <Link href="/leave/new" className="text-sm underline">
                Скасувати
              </Link>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

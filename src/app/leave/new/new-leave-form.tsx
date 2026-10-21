"use client";

import Link from "next/link";
import { useActionState } from "react";
import { previewLeaveRequest, submitLeaveRequest } from "../actions";
import type { LeaveFormState } from "../state";

type PositionOption = { id: string; label: string };
type LeaveTypeOption = { value: string; label: string };

const INPUT_CLASS = "rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
const IDLE: LeaveFormState = { status: "idle" };

export function NewLeaveForm({
  positions,
  leaveTypes,
}: {
  positions: PositionOption[];
  leaveTypes: LeaveTypeOption[];
}) {
  const [preview, previewAction, previewPending] = useActionState(previewLeaveRequest, IDLE);
  const [submit, submitAction, submitPending] = useActionState(submitLeaveRequest, IDLE);

  if (positions.length === 0) {
    return <p role="status">У вас немає посад, тож подати заявку не можна. Зверніться до адміністратора.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <form action={previewAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Дата відсутності
          <input name="date" type="date" required className={INPUT_CLASS} />
        </label>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">Посада (цілий день)</legend>
          {positions.map((position, index) => (
            <label key={position.id} className="flex items-center gap-2">
              <input type="radio" name="positionId" value={position.id} defaultChecked={index === 0} required />
              {position.label}
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          Тип відпустки
          <select name="leaveType" required defaultValue={leaveTypes[0]?.value} className={INPUT_CLASS}>
            {leaveTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        {preview.status === "error" ? (
          <p role="alert" className="text-sm text-red-600">
            {preview.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={previewPending}
          className="self-start rounded bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
        >
          Показати підсумок
        </button>
      </form>

      {preview.status === "summary" ? (
        <section aria-labelledby="summary-title" className="flex flex-col gap-4">
          <h2 id="summary-title" className="text-lg font-semibold">
            Підсумок
          </h2>
          <p className="text-sm text-zinc-500">Тип: {preview.leaveTypeLabel}</p>
          <ul className="flex flex-col gap-2 text-sm" data-testid="summary-lines">
            {preview.lines.map((line) => (
              <li key={`${line.date}-${line.position}`} className="rounded border border-zinc-300 p-3 dark:border-zinc-700">
                {line.date}, {line.hours} ({line.duration}), {line.position}: {line.status}
              </li>
            ))}
          </ul>

          <form action={submitAction} className="flex flex-col gap-3">
            <input type="hidden" name="leaveType" value={preview.values.leaveType} />
            {preview.values.dates.map((date) => (
              <input key={date} type="hidden" name="date" value={date} />
            ))}
            {preview.values.positionIds.map((id) => (
              <input key={id} type="hidden" name="positionId" value={id} />
            ))}

            {submit.status === "error" ? (
              <p role="alert" className="text-sm text-red-600">
                {submit.message}
              </p>
            ) : null}

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={submitPending}
                className="rounded bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
              >
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

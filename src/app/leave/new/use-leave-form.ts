"use client";

import { type FormEvent, useActionState, useState, useTransition } from "react";
import type { Closure } from "@/lib/leave/closures";
import { clickDay } from "@/lib/leave/date-selection";
import { dateError as checkDate, hoursStepError, positionsError } from "@/lib/leave/form-checks";
import { previewLeaveRequest, submitLeaveRequest } from "../actions";
import type { LeaveFormState } from "../state";

export type PositionOption = { id: string; label: string; weekdays: number[] };
export type LeaveTypeOption = { value: string; label: string };
export type Mode = "whole-day" | "hours";

const IDLE: LeaveFormState = { status: "idle" };

type KeyValues = {
  leaveType: string;
  dates: string[];
  positionIds: string[];
  mode: Mode;
  startsAt: string;
  endsAt: string;
  relationship: string;
  comment: string;
};

// Стабільний ключ значень форми: за ним відрізняємо підсумок для поточних даних від застарілого.
function keyOf(values: KeyValues) {
  return JSON.stringify({ ...values, dates: [...new Set(values.dates)].sort(), positionIds: [...new Set(values.positionIds)].sort() });
}

// Ключ значень, з якими сервер порахував підсумок (форма подання відправляє їх знову).
function summaryKey(preview: Extract<LeaveFormState, { status: "summary" }>) {
  const { values } = preview;
  return keyOf({
    leaveType: values.leaveType,
    dates: values.dates,
    positionIds: values.positionIds,
    mode: values.hours ? "hours" : "whole-day",
    startsAt: values.hours?.startsAt ?? "",
    endsAt: values.hours?.endsAt ?? "",
    relationship: values.relationship ?? "",
    comment: (values.comment ?? "").trim(),
  });
}

// Що не так із формою до запиту на сервер: жодної посади (AC-LEAVE-10) або жодної прийнятої дати (тоді показуємо першу помилку дати).
function previewProblem(
  selected: string[],
  accepted: string[],
  dates: string[],
  dateError: (date: string) => string | null,
  hours: { mode: Mode; startsAt: string; endsAt: string },
): string | null {
  const noPositions = positionsError(selected);
  if (noPositions) {
    return noPositions;
  }
  if (accepted.length === 0) {
    return dates.map(dateError).find((message) => message !== null) ?? "Choose at least one date.";
  }
  return hours.mode === "hours" ? hoursStepError(hours.startsAt, hours.endsAt) : null;
}

type PreviewValues = {
  leaveType: string;
  acceptedDates: string[];
  selected: string[];
  mode: Mode;
  startsAt: string;
  endsAt: string;
  isFamily: boolean;
  relationship: string;
  comment: string;
};

function toFormData(values: PreviewValues): FormData {
  const formData = new FormData();
  formData.set("leaveType", values.leaveType);
  values.acceptedDates.forEach((date) => formData.append("date", date));
  values.selected.forEach((id) => formData.append("positionId", id));
  formData.set("mode", values.mode);
  if (values.mode === "hours") {
    formData.set("startsAt", values.startsAt);
    formData.set("endsAt", values.endsAt);
  }
  if (values.isFamily) {
    formData.set("relationship", values.relationship);
  }
  formData.set("comment", values.comment);
  return formData;
}

const toggled = (selected: string[], id: string, checked: boolean): string[] => (checked ? [...selected, id] : selected.filter((value) => value !== id));

const freshSummary = (preview: LeaveFormState, key: string) => (preview.status === "summary" && summaryKey(preview) === key ? preview : null);

// Стан і правила форми «Нова заявка». Значення тримаємо в стані React, тож вони не скидаються після помилки чи підсумку
// (AC-LEAVE-11). Дату не приймаємо, якщо жодна з обраних посад не має розкладу в цей день тижня (AC-LEAVE-06) чи день закритий
// (AC-CAL-03). Жодної обраної посади — окреме повідомлення PM при поданні (AC-LEAVE-10), тож біля дати помилки немає.
export function useLeaveForm({ positions, leaveTypes, closures }: { positions: PositionOption[]; leaveTypes: LeaveTypeOption[]; closures: Closure[] }) {
  const [preview, previewAction, previewPending] = useActionState(previewLeaveRequest, IDLE);
  const [submit, submitAction, submitPending] = useActionState(submitLeaveRequest, IDLE);
  const [isTransition, startTransition] = useTransition();

  const [dates, setDates] = useState<string[]>([""]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(positions.map((position) => position.id));
  const [mode, setMode] = useState<Mode>("whole-day");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [leaveType, setLeaveType] = useState(leaveTypes[0]?.value ?? "");
  const [relationship, setRelationship] = useState("");
  const [comment, setComment] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const current = () => ({
    leaveType,
    positionIds: selected,
    mode,
    startsAt: mode === "hours" ? startsAt : "",
    endsAt: mode === "hours" ? endsAt : "",
    relationship: isFamily ? relationship : "",
    comment: comment.trim(),
  });
  const isFamily = leaveType === "family";
  const dateError = (date: string): string | null => checkDate(date, positions, selected, closures);
  const acceptedDates = dates.filter((date) => date !== "" && dateError(date) === null);
  const currentKey = keyOf({ ...current(), dates: acceptedDates });
  // Підсумок показуємо лише для тих значень, що зараз у формі; після змін він застаріває.
  const summary = freshSummary(preview, currentKey);

  const pickDay = (day: string) => {
    const next = clickDay(dates, anchor, day, (date) => dateError(date) === null);
    setDates(next.dates);
    setAnchor(next.anchor);
  };

  const togglePosition = (id: string, checked: boolean) => setSelected(toggled(selected, id, checked));

  const onPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = previewProblem(selected, acceptedDates, dates, dateError, { mode, startsAt, endsAt });
    setLocalError(problem);
    if (problem === null) {
      const formData = toFormData({ leaveType, acceptedDates, selected, mode, startsAt, endsAt, isFamily, relationship, comment });
      startTransition(() => {
        previewAction(formData);
      });
    }
  };

  return {
    positions,
    leaveTypes,
    values: { dates, anchor, selected, mode, startsAt, endsAt, leaveType, relationship, comment },
    set: { setDates, setSelected, setMode, setStartsAt, setEndsAt, setLeaveType, setRelationship, setComment },
    dateError,
    acceptedDates,
    isFamily,
    pickDay,
    togglePosition,
    onPreview,
    preview,
    summary,
    submit,
    submitAction,
    submitPending,
    pending: previewPending || isTransition,
    localError,
  };
}

export type LeaveFormModel = ReturnType<typeof useLeaveForm>;

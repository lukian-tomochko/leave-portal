import type { RequestInput } from "./types";
import { LEAVE_TYPES, type LeaveType } from "./types";

export type FormParse = { ok: true; input: RequestInput } | { ok: false };

function isLeaveType(value: string): value is LeaveType {
  return (LEAVE_TYPES as readonly string[]).includes(value);
}

// Розбір FormData у вхід planRequest. Значення з форми не довіряємо: усе перевіряє planRequest і база.
export function parseRequestForm(formData: FormData): FormParse {
  const leaveType = String(formData.get("leaveType") ?? "");
  const dates = formData
    .getAll("date")
    .map((value) => String(value).trim())
    .filter((value) => value !== "");
  const positionIds = formData
    .getAll("positionId")
    .map((value) => String(value))
    .filter((value) => value !== "");

  if (!isLeaveType(leaveType)) {
    return { ok: false };
  }
  return { ok: true, input: { leaveType, dates, positionIds } };
}

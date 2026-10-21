import type { RequestInput } from "./types";
import { LEAVE_TYPES, type LeaveType } from "./types";

export type FormParse = { ok: true; input: RequestInput } | { ok: false };

function isLeaveType(value: string): value is LeaveType {
  return (LEAVE_TYPES as readonly string[]).includes(value);
}

// Розбір FormData у вхід planRequest. Значення з форми не довіряємо: усе перевіряє planRequest і база.
// Режим «години» (mode=hours) вимагає обох полів часу; режим «цілий день» поля часу ігнорує.
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

  const input: RequestInput = { leaveType, dates, positionIds };

  if (String(formData.get("mode") ?? "") === "hours") {
    const startsAt = String(formData.get("startsAt") ?? "").trim();
    const endsAt = String(formData.get("endsAt") ?? "").trim();
    if (startsAt === "" || endsAt === "") {
      return { ok: false };
    }
    input.hours = { startsAt, endsAt };
  }

  return { ok: true, input };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseRequestForm } from "@/lib/leave/form";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/leave/messages";
import { positionLabel } from "@/lib/leave/schedule";
import { createSupabaseLeaveRepository } from "@/lib/leave/supabase-repository";
import { formatDuration } from "@/lib/leave/time";
import { previewRequest, submitRequest } from "@/lib/leave/use-cases";
import { createClient } from "@/lib/supabase/server";
import type { LeaveFormState } from "./state";

// Нейтральна фраза для технічних помилок: PM тексту для них не давав, а деталей користувачу не показуємо.
const TECHNICAL_ERROR = "Не вдалося обробити заявку. Спробуйте ще раз.";

const errorState = (code: string, message: string): LeaveFormState => ({
  status: "error",
  message: code === "INVALID_INPUT" ? TECHNICAL_ERROR : message,
});

// Автентифікація й авторизація — всередині кожної дії, навіть якщо форма лежить на захищеній сторінці.
// getClaims() перевіряє JWT; getSession() для авторизації на сервері не використовуємо.
async function authorize() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const employeeId = data?.claims?.sub;
  if (!employeeId) {
    redirect("/login");
  }
  return { employeeId, repository: createSupabaseLeaveRepository(supabase) };
}

// Крок 1: перевіряє заявку й показує підсумок. Нічого не записує (AC-LEAVE-11).
export async function previewLeaveRequest(_previous: LeaveFormState, formData: FormData): Promise<LeaveFormState> {
  const { employeeId, repository } = await authorize();

  const parsed = parseRequestForm(formData);
  if (!parsed.ok) {
    return { status: "error", message: TECHNICAL_ERROR };
  }

  let outcome;
  try {
    outcome = await previewRequest(repository, employeeId, parsed.input);
  } catch {
    return { status: "error", message: TECHNICAL_ERROR };
  }
  if (!outcome.ok) {
    return errorState(outcome.code, outcome.message);
  }

  return {
    status: "summary",
    values: parsed.input,
    leaveTypeLabel: LEAVE_TYPE_LABELS[outcome.leaveType],
    comment: outcome.comment,
    skippedDates: outcome.skippedDates,
    lines: outcome.records.map((record) => {
      const position = outcome.positions.find((p) => p.id === record.positionId);
      return {
        date: record.date,
        hours: `${record.startsAt}–${record.endsAt}`,
        duration: formatDuration(record.minutes),
        position: position ? positionLabel(position) : "—",
        status: STATUS_LABELS[record.status],
      };
    }),
  };
}

// Крок 2: створює заявку з усіма записами однією транзакцією (AC-LEAVE-05, AC-LEAVE-16).
export async function submitLeaveRequest(_previous: LeaveFormState, formData: FormData): Promise<LeaveFormState> {
  const { employeeId, repository } = await authorize();

  const parsed = parseRequestForm(formData);
  if (!parsed.ok) {
    return { status: "error", message: TECHNICAL_ERROR };
  }

  let outcome;
  try {
    outcome = await submitRequest(repository, employeeId, parsed.input);
  } catch {
    return { status: "error", message: TECHNICAL_ERROR };
  }
  if (!outcome.ok) {
    return errorState(outcome.code, outcome.message);
  }

  // redirect() кидає виняток, тому він поза try/catch.
  revalidatePath("/leave");
  redirect("/leave");
}

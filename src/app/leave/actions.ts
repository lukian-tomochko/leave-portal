"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseRequestForm } from "@/lib/leave/form";
import { LEAVE_TYPE_LABELS, STATUS_LABELS } from "@/lib/leave/messages";
import { planRequest } from "@/lib/leave/request";
import { positionLabel } from "@/lib/leave/schedule";
import { createSupabaseLeaveRepository } from "@/lib/leave/supabase-repository";
import { formatDuration } from "@/lib/leave/time";
import { createClient } from "@/lib/supabase/server";
import type { LeaveFormState } from "./state";

// Нейтральна фраза для технічних помилок: PM тексту для них не давав, а деталей користувачу не показуємо.
const TECHNICAL_ERROR = "Не вдалося обробити заявку. Спробуйте ще раз.";

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

// Крок 1: перевіряє заявку й показує підсумок. Нічого не записує (AC-LEAVE-11 — задача 3).
export async function previewLeaveRequest(_previous: LeaveFormState, formData: FormData): Promise<LeaveFormState> {
  const { employeeId, repository } = await authorize();

  const parsed = parseRequestForm(formData);
  if (!parsed.ok) {
    return { status: "error", message: TECHNICAL_ERROR };
  }

  let positions;
  try {
    positions = await repository.loadPositions(employeeId);
  } catch {
    return { status: "error", message: TECHNICAL_ERROR };
  }

  const plan = planRequest(parsed.input, { positions });
  if (!plan.ok) {
    return { status: "error", message: plan.code === "INVALID_INPUT" ? TECHNICAL_ERROR : plan.message };
  }

  return {
    status: "summary",
    values: parsed.input,
    leaveTypeLabel: LEAVE_TYPE_LABELS[plan.leaveType],
    lines: plan.records.map((record) => {
      const position = positions.find((p) => p.id === record.positionId);
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

// Крок 2: створює заявку. Усе перевіряє наново — значення з форми підтвердження не довіряємо.
export async function submitLeaveRequest(_previous: LeaveFormState, formData: FormData): Promise<LeaveFormState> {
  const { employeeId, repository } = await authorize();

  const parsed = parseRequestForm(formData);
  if (!parsed.ok) {
    return { status: "error", message: TECHNICAL_ERROR };
  }

  try {
    const positions = await repository.loadPositions(employeeId);
    const plan = planRequest(parsed.input, { positions });
    if (!plan.ok) {
      return { status: "error", message: plan.code === "INVALID_INPUT" ? TECHNICAL_ERROR : plan.message };
    }
    await repository.createRequest({ leaveType: plan.leaveType, records: plan.records });
  } catch {
    return { status: "error", message: TECHNICAL_ERROR };
  }

  // redirect() кидає виняток, тому він поза try/catch.
  revalidatePath("/leave");
  redirect("/leave");
}

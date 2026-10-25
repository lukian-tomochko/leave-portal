"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DecisionDeniedError, NOT_ALLOWED } from "@/lib/leave/decision";
import { cancelRecord, changeHours } from "@/lib/leave/employee-record";
import { createSupabaseEmployeeRepository } from "@/lib/leave/supabase-employee-repository";
import { createClient } from "@/lib/supabase/server";
import type { RecordActionState } from "./state";

// Нейтральна фраза для технічних помилок: PM тексту для них не давав.
const TECHNICAL_ERROR = "Не вдалося зберегти зміну. Спробуйте ще раз.";
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Автентифікація — всередині кожної дії: Server Action — публічний POST-ендпойнт, тож перевірка в proxy чи схована
// кнопка не захищають. getClaims() перевіряє JWT; getSession() для авторизації на сервері не використовуємо.
// Власника запису остаточно перевіряє функція бази (і RLS): чужий запис змінити не можна.
async function authorize() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const employeeId = data?.claims?.sub;
  if (!employeeId) {
    redirect("/login");
  }
  return { employeeId, repository: createSupabaseEmployeeRepository(supabase) };
}

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : undefined);

// Зміна годин власного запису (AC-DECIDE-06, 16, 12, 21, 22). Поля leaveType, date і positionId форма не показує,
// але прямий запит може їх надіслати: будь-яка відмінність від запису — відмова з текстом PM (AC-DECIDE-21).
export async function updateLeaveRecordHours(
  _previous: RecordActionState,
  formData: FormData,
): Promise<RecordActionState> {
  const { employeeId, repository } = await authorize();

  const recordId = text(formData.get("recordId"));
  const startsAt = text(formData.get("startsAt"));
  const endsAt = text(formData.get("endsAt"));
  if (!recordId || !startsAt || !endsAt || !TIME_RE.test(startsAt) || !TIME_RE.test(endsAt)) {
    return { status: "error", message: TECHNICAL_ERROR };
  }

  let outcome;
  try {
    outcome = await changeHours(repository, employeeId, {
      recordId,
      startsAt,
      endsAt,
      requested: {
        leaveType: text(formData.get("leaveType")),
        date: text(formData.get("date")),
        positionId: text(formData.get("positionId")),
      },
    });
  } catch (error) {
    if (error instanceof DecisionDeniedError) {
      return { status: "error", message: NOT_ALLOWED };
    }
    // Адаптери формують повідомлення лише з назви операції й коду Supabase, тож message не містить даних користувача.
    console.error("updateLeaveRecordHours failed", error instanceof Error ? error.message : "unknown");
    return { status: "error", message: TECHNICAL_ERROR };
  }
  if (!outcome.ok) {
    return { status: "error", message: outcome.message };
  }

  // redirect() кидає виняток, тому він поза try/catch.
  revalidatePath("/leave");
  revalidatePath(`/records/${recordId}`);
  redirect("/leave");
}

// Скасування власного запису (AC-DECIDE-13, AC-DECIDE-17).
export async function cancelLeaveRecord(_previous: RecordActionState, formData: FormData): Promise<RecordActionState> {
  const { employeeId, repository } = await authorize();

  const recordId = text(formData.get("recordId"));
  if (!recordId) {
    return { status: "error", message: TECHNICAL_ERROR };
  }

  let outcome;
  try {
    outcome = await cancelRecord(repository, employeeId, recordId);
  } catch (error) {
    if (error instanceof DecisionDeniedError) {
      return { status: "error", message: NOT_ALLOWED };
    }
    console.error("cancelLeaveRecord failed", error instanceof Error ? error.message : "unknown");
    return { status: "error", message: TECHNICAL_ERROR };
  }
  if (!outcome.ok) {
    return { status: "error", message: outcome.message };
  }

  revalidatePath("/leave");
  revalidatePath("/decisions");
  redirect("/leave");
}

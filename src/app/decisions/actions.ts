"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NOT_ALLOWED, decideRecord, isDecider, isDecision } from "@/lib/leave/decision";
import { createSupabaseDecisionRepository, loadActor } from "@/lib/leave/supabase-decision-repository";
import { createClient } from "@/lib/supabase/server";
import type { DecisionFormState } from "./state";

// Нейтральна фраза для технічних помилок: PM тексту для них не давав.
const TECHNICAL_ERROR = "Не вдалося зберегти рішення. Спробуйте ще раз.";

// Рішення менеджера чи адміністратора. Автентифікація й авторизація — всередині дії: Server Action — публічний
// POST-ендпойнт, тож перевірка в proxy чи схована кнопка не захищають. Права остаточно перевіряє функція бази
// decide_leave_record (AC-DECIDE-08, AC-DECIDE-09, AC-DECIDE-18); тут роль перевіряється першою, до будь-якого запису.
export async function decideLeaveRecord(_previous: DecisionFormState, formData: FormData): Promise<DecisionFormState> {
  const supabase = await createClient();
  // getClaims() перевіряє JWT; getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  let outcome;
  try {
    // Роль — з public.profiles, ніколи з user_metadata.
    const actor = await loadActor(supabase, userId);
    if (!actor || !isDecider(actor.role)) {
      return { status: "error", message: NOT_ALLOWED };
    }

    const recordId = String(formData.get("recordId") ?? "");
    const decision = formData.get("decision");
    const comment = formData.get("comment");
    if (!recordId || !isDecision(decision)) {
      return { status: "error", message: TECHNICAL_ERROR };
    }

    outcome = await decideRecord(
      createSupabaseDecisionRepository(supabase),
      recordId,
      decision,
      typeof comment === "string" ? comment : undefined,
    );
  } catch (error) {
    // Адаптери формують повідомлення лише з назви операції й коду Supabase, тож message не містить даних користувача.
    console.error("decideLeaveRecord failed", error instanceof Error ? error.message : "unknown");
    return { status: "error", message: TECHNICAL_ERROR };
  }
  if (!outcome.ok) {
    return { status: "error", message: outcome.message };
  }

  // redirect() кидає виняток, тому він поза try/catch.
  revalidatePath("/decisions");
  revalidatePath("/decisions/history");
  redirect("/decisions");
}

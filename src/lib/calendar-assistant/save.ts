import type { SupabaseClient } from "@supabase/supabase-js";
import type { Closure } from "@/lib/leave/closures";
import { addClosureMessage } from "@/lib/leave/calendar-admin";
import { CLOSURE_TECHNICAL_ERROR, ONLY_ADMIN_CALENDAR } from "@/lib/leave/messages";
import type { Database } from "@/lib/supabase/database.types";

// Збереження одного закриття наявною функцією бази add_school_closure під сесією адміністратора (ADR 0007). Спільне для
// ручної форми (`/calendar/manage`) і збереження пропозицій помічника: правила й повідомлення вимоги 04 одні й ті самі.
// Помічник нічого не пише сам: сюди потрапляє лише те, що адміністратор переглянув і натиснув «Save».
export type SaveClosureResult = { ok: true } | { ok: false; message: string };

export async function saveClosure(supabase: SupabaseClient<Database>, closure: Closure): Promise<SaveClosureResult> {
  const { data, error } = await supabase.rpc("add_school_closure", {
    p_name: closure.name,
    p_starts_on: closure.startsOn,
    p_ends_on: closure.endsOn,
    ...(closure.closedFrom === null ? {} : { p_closed_from: closure.closedFrom }),
  });
  if (error) {
    // 42501 — база відмовила за роллю (AC-CAL-13).
    return { ok: false, message: error.code === "42501" ? ONLY_ADMIN_CALENDAR : CLOSURE_TECHNICAL_ERROR };
  }
  const message = addClosureMessage(data);
  return message === null ? { ok: true } : { ok: false, message };
}

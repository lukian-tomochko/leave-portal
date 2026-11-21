"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { productModel } from "@/lib/ai/openrouter";
import { suggestClosures } from "@/lib/calendar-assistant/suggest";
import { saveClosure } from "@/lib/calendar-assistant/save";
import { parseClosureForm } from "@/lib/leave/calendar-admin";
import { ASSISTANT_UNAVAILABLE, CLOSURE_TECHNICAL_ERROR, ONLY_ADMIN_CALENDAR } from "@/lib/leave/messages";
import { todayInKyiv } from "@/lib/leave/time";
import { createClient } from "@/lib/supabase/server";
import type { AssistantState, RowResult, SaveState, SuggestionRow } from "./state";

// Адміністратор: getClaims() перевіряє JWT, роль — з public.profiles (ніколи з user_metadata). Server Action — публічний
// POST-ендпойнт, тож перевірка тут обов'язкова незалежно від сторінки (design.md D5): до моделі й до запису.
async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) {
    throw new Error(`requireAdmin failed: ${error.code ?? "unknown"}`);
  }
  return { supabase, isAdmin: profile?.role === "admin" };
}

// Запит пропозицій (AC-ASSIST-01, 05, 06, 07, 09, 10, 11). Дія нічого не пише в базу: модель не бачить клієнта Supabase,
// а пропозиції повертаються у форму на перегляд.
export async function requestSuggestions(_previous: AssistantState, formData: FormData): Promise<AssistantState> {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return { status: "message", kind: "error", message: ONLY_ADMIN_CALENDAR };
    }
    const raw = formData.get("text");
    const text = typeof raw === "string" ? raw : "";
    const result = await suggestClosures(text, todayInKyiv(), productModel(), { log: { requestId: crypto.randomUUID(), route: "/calendar/assistant" } });
    switch (result.status) {
      case "ok":
        return {
          status: "suggested",
          requestId: Date.now(),
          rows: result.closures.map((closure, index) => ({
            key: `${Date.now()}-${index}`,
            name: closure.name,
            kind: closure.closedFrom === null ? "whole" : "early",
            startsOn: closure.startsOn,
            endsOn: closure.endsOn,
            time: closure.closedFrom ?? "",
          })),
        };
      case "needs_info":
        return { status: "message", kind: "needs_info", message: result.message };
      case "refused":
        return { status: "message", kind: "refused", message: result.message };
      case "text_too_long":
        return { status: "message", kind: "too_long", message: result.message };
      case "unavailable":
        // Причину (немає ключа, 429, таймаут) лише в лог сервера, без тексту користувача й без ключа.
        console.error("calendar assistant unavailable", result.detail);
        return { status: "message", kind: "unavailable", message: result.message };
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error("requestSuggestions failed", error instanceof Error ? error.message : "unknown");
    return { status: "message", kind: "unavailable", message: ASSISTANT_UNAVAILABLE };
  }
}

// Рядки, які клієнт надіслав на збереження: сервер не довіряє їм і перевіряє заново (zod + правила вимоги 04).
const RowsSchema = z
  .array(
    z.object({
      key: z.string().max(80),
      name: z.string().max(400),
      kind: z.enum(["whole", "early"]),
      startsOn: z.string().max(20),
      endsOn: z.string().max(20),
      time: z.string().max(10),
    }),
  )
  .max(30);

// Збереження переглянутих пропозицій (AC-ASSIST-02, 03, 04): кожен рядок окремо, ті, що пройшли, зберігаються, навіть
// якщо інші відхилено. Модель тут не викликається.
export async function saveSuggestions(_previous: SaveState, formData: FormData): Promise<SaveState> {
  try {
    const { supabase, isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return { status: "error", message: ONLY_ADMIN_CALENDAR };
    }
    let rows: SuggestionRow[];
    try {
      rows = RowsSchema.parse(JSON.parse(String(formData.get("rows") ?? "[]")));
    } catch {
      return { status: "error", message: CLOSURE_TECHNICAL_ERROR };
    }
    const results: RowResult[] = [];
    for (const row of rows) {
      const parsed = parseClosureForm({
        kind: row.kind,
        name: row.name,
        startsOn: row.startsOn,
        endsOn: row.endsOn,
        date: row.startsOn,
        time: row.time,
      });
      if (!parsed.ok) {
        results.push({ key: row.key, ok: false, message: parsed.message });
        continue;
      }
      const saved = await saveClosure(supabase, parsed.input);
      results.push(saved.ok ? { key: row.key, ok: true } : { key: row.key, ok: false, message: saved.message });
    }
    revalidatePath("/calendar");
    revalidatePath("/calendar/manage");
    return { status: "done", results };
  } catch (error) {
    unstable_rethrow(error);
    console.error("saveSuggestions failed", error instanceof Error ? error.message : "unknown");
    return { status: "error", message: CLOSURE_TECHNICAL_ERROR };
  }
}

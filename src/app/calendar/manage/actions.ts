"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { addClosureMessage, parseClosureForm, removeClosureMessage } from "@/lib/leave/calendar-admin";
import { isRecordId } from "@/lib/leave/decision";
import { CLOSURE_TECHNICAL_ERROR, ONLY_ADMIN_CALENDAR } from "@/lib/leave/messages";
import { createClient } from "@/lib/supabase/server";
import type { ClosureFormState } from "./state";

const field = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

// Адміністратор: getClaims() перевіряє JWT, роль — з public.profiles (ніколи з user_metadata). Server Action — публічний
// POST-ендпойнт, тож перевірка тут обов'язкова незалежно від сторінки; остаточно права тримає функція бази (AC-CAL-13).
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

// Додавання закриття (AC-CAL-01, 07, 08, 10, 11).
export async function addClosure(_previous: ClosureFormState, formData: FormData): Promise<ClosureFormState> {
  try {
    const { supabase, isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return { status: "error", message: ONLY_ADMIN_CALENDAR };
    }
    const parsed = parseClosureForm({
      kind: field(formData, "kind"),
      name: field(formData, "name"),
      startsOn: field(formData, "startsOn"),
      endsOn: field(formData, "endsOn"),
      date: field(formData, "date"),
      time: field(formData, "time"),
    });
    if (!parsed.ok) {
      return { status: "error", message: parsed.message };
    }
    const { name, startsOn, endsOn, closedFrom } = parsed.input;
    const { data, error } = await supabase.rpc("add_school_closure", {
      p_name: name,
      p_starts_on: startsOn,
      p_ends_on: endsOn,
      ...(closedFrom === null ? {} : { p_closed_from: closedFrom }),
    });
    if (error) {
      // 42501 — база відмовила за роллю (AC-CAL-13).
      return { status: "error", message: error.code === "42501" ? ONLY_ADMIN_CALENDAR : CLOSURE_TECHNICAL_ERROR };
    }
    const message = addClosureMessage(data);
    if (message !== null) {
      return { status: "error", message };
    }
  } catch (error) {
    // redirect() усередині try кидає службовий виняток Next.js: його не ковтаємо.
    unstable_rethrow(error);
    console.error("addClosure failed", error instanceof Error ? error.message : "unknown");
    return { status: "error", message: CLOSURE_TECHNICAL_ERROR };
  }
  revalidatePath("/calendar");
  revalidatePath("/calendar/manage");
  return { status: "saved" };
}

// Видалення закриття (AC-CAL-09): остаточна дія, підтверджується діалогом на сторінці.
export async function removeClosure(_previous: ClosureFormState, formData: FormData): Promise<ClosureFormState> {
  try {
    const { supabase, isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return { status: "error", message: ONLY_ADMIN_CALENDAR };
    }
    const id = field(formData, "id");
    if (!isRecordId(id)) {
      return { status: "error", message: CLOSURE_TECHNICAL_ERROR };
    }
    const { data, error } = await supabase.rpc("remove_school_closure", { p_id: id });
    if (error) {
      return { status: "error", message: error.code === "42501" ? ONLY_ADMIN_CALENDAR : CLOSURE_TECHNICAL_ERROR };
    }
    const message = removeClosureMessage(data);
    if (message !== null) {
      return { status: "error", message };
    }
  } catch (error) {
    // redirect() усередині try кидає службовий виняток Next.js: його не ковтаємо.
    unstable_rethrow(error);
    console.error("removeClosure failed", error instanceof Error ? error.message : "unknown");
    return { status: "error", message: CLOSURE_TECHNICAL_ERROR };
  }
  revalidatePath("/calendar");
  revalidatePath("/calendar/manage");
  return { status: "saved" };
}

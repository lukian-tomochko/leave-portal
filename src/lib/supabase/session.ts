import { cache } from "react";
import { isDecider, type Actor } from "@/lib/leave/decision";
import { countAwaiting, loadActor } from "@/lib/leave/supabase-decision-repository";
import { createClient } from "./server";

// Дані сесії, що потрібні і сайдбару, і сторінці в одному запиті. React cache() об'єднує виклики в межах одного рендеру:
// профіль, роль, «хто діє» і лічильник черги читаються з бази один раз, а не в layout і в сторінці окремо.
// getClaims() перевіряє JWT; getSession() для авторизації на сервері не використовуємо.

export const getClaims = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
});

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("email, full_name, role").eq("id", userId).maybeSingle();
  return data;
});

// Хто діє: роль уже відома з профілю, тож зайвий запит у profiles не потрібен — лише посади, за які відповідає менеджер.
export const getActor = cache(async (userId: string): Promise<Actor | null> => {
  const profile = await getProfile(userId);
  if (!profile) {
    return null;
  }
  return loadActor(await createClient(), userId, profile.role as Actor["role"]);
});

// Скільки записів чекає рішення; для працівника нуль.
export const getAwaitingCount = cache(async (userId: string): Promise<number> => {
  const actor = await getActor(userId);
  return actor && isDecider(actor.role) ? countAwaiting(await createClient(), actor) : 0;
});

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Навмисна помилка сервера для перевірки трекера (WS11, трек B; ADR 0011): адміністратор відкриває /ops/error-probe, маршрут
// кидає необроблену помилку, Next.js викликає onRequestError (src/instrumentation.ts), і в Telegram-групі з'являється
// повідомлення з маршрутом і стеком. Маршрут закритий роллю адміністратора (роль — з public.profiles, не з user_metadata):
// решта отримує 401/403 і помилки не створює. Текст помилки в повідомлення не потрапляє (див. src/lib/error-alert.ts).
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error || profile?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  throw new Error("ops/error-probe: deliberate test error");
}

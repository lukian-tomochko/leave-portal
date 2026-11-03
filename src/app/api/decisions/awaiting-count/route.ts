import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Кількість записів «Awaiting decision» для шапки менеджера.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: count, error } = await supabase.rpc("awaiting_decision_count");
  if (error) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ count }, { headers: { "cache-control": "no-store" } });
}

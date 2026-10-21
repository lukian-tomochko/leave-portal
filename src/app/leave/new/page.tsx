import Link from "next/link";
import { redirect } from "next/navigation";
import { LEAVE_TYPE_LABELS } from "@/lib/leave/messages";
import { positionLabel } from "@/lib/leave/schedule";
import { createSupabaseLeaveRepository } from "@/lib/leave/supabase-repository";
import { LEAVE_TYPES } from "@/lib/leave/types";
import { createClient } from "@/lib/supabase/server";
import { NewLeaveForm } from "./new-leave-form";

// Форма подання заявки. Сторінка читає cookies, тож рендериться динамічно.
export default async function NewLeavePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const employeeId = data?.claims?.sub;
  if (!employeeId) {
    redirect("/login");
  }

  // Під RLS працівник бачить лише власні посади.
  const positions = await createSupabaseLeaveRepository(supabase).loadPositions(employeeId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/leave" className="text-sm underline">
        ← Мої заявки
      </Link>
      <h1 className="text-2xl font-semibold">Нова заявка на відпустку</h1>
      <NewLeaveForm
        positions={positions.map((position) => ({ id: position.id, label: positionLabel(position) }))}
        leaveTypes={LEAVE_TYPES.map((type) => ({ value: type, label: LEAVE_TYPE_LABELS[type] }))}
      />
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/bento/page-header";
import { balancesOn } from "@/lib/leave/balance";
import { LEAVE_TYPE_LABELS } from "@/lib/leave/messages";
import { positionLabel } from "@/lib/leave/schedule";
import { loadBalanceInputs } from "@/lib/leave/supabase-balance-repository";
import { createSupabaseLeaveRepository } from "@/lib/leave/supabase-repository";
import { todayInKyiv } from "@/lib/leave/time";
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
  const repository = createSupabaseLeaveRepository(supabase);
  const today = todayInKyiv();
  // Закриття шкільного календаря на найближчі два роки: форма одразу відхиляє закритий день (AC-CAL-03). Залишок балансу лише
  // довідка в чернетці: якщо його не вдалося прочитати, форма працює без нього.
  const [positions, closures, balanceInputs] = await Promise.all([
    repository.loadPositions(employeeId),
    repository.loadClosures([today, `${Number(today.slice(0, 4)) + 2}-12-31`]),
    loadBalanceInputs(supabase, employeeId).catch(() => null),
  ]);
  const balances = balanceInputs ? balancesOn(balanceInputs, today) : null;

  return (
    <main className="flex w-full flex-1 flex-col gap-4 py-2">
      <Link href="/leave" className="w-fit px-1 text-sm text-muted-foreground underline">
        ← Мої заявки
      </Link>
      <PageHeader title="Нова заявка на відпустку" description="Оберіть тип і дні в календарі. Підсумок оновлюється праворуч." />
      <NewLeaveForm
        positions={positions.map((position) => ({
          id: position.id,
          label: positionLabel(position),
          weekdays: [...new Set(position.blocks.map((block) => block.weekday))],
        }))}
        leaveTypes={LEAVE_TYPES.map((type) => ({ value: type, label: LEAVE_TYPE_LABELS[type] }))}
        closures={closures}
        today={today}
        remaining={{ sick: balances?.sick.remaining ?? 0, personal: balances?.personal.remaining ?? 0 }}
      />
    </main>
  );
}

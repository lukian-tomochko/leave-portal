import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/bento/page-header";
import { Tile } from "@/components/bento/tile";
import { LEAVE_TYPE_LABELS } from "@/lib/leave/messages";
import { positionLabel } from "@/lib/leave/schedule";
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
  const positions = await repository.loadPositions(employeeId);
  // Закриття шкільного календаря на найближчі два роки: форма одразу відхиляє закритий день (AC-CAL-03).
  const today = todayInKyiv();
  const closures = await repository.loadClosures([today, `${Number(today.slice(0, 4)) + 2}-12-31`]);

  return (
    <main className="flex w-full max-w-3xl flex-1 flex-col gap-4 py-2">
      <Link href="/leave" className="w-fit px-1 text-sm text-muted-foreground underline">
        ← Мої заявки
      </Link>
      <PageHeader title="Нова заявка на відпустку" />
      <Tile index={0}>
      <NewLeaveForm
        positions={positions.map((position) => ({
          id: position.id,
          label: positionLabel(position),
          weekdays: [...new Set(position.blocks.map((block) => block.weekday))],
        }))}
        leaveTypes={LEAVE_TYPES.map((type) => ({ value: type, label: LEAVE_TYPE_LABELS[type] }))}
        closures={closures}
      />
      </Tile>
    </main>
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { BalanceDeniedError, type ApprovedRecord, type BalanceInputs } from "./balance";
import { trimSeconds } from "./time";
import type { LeaveType, Position, PositionKind } from "./types";

type RawInputs = {
  positions: {
    id: string;
    kind: string;
    division: string;
    job_title: string;
    blocks: { weekday: number; starts_at: string; ends_at: string }[];
  }[];
  records: {
    id: string;
    position_id: string;
    date: string;
    starts_at: string;
    ends_at: string;
    leave_type: string;
    paid_share: number | string | null;
    unpaid_share: number | string;
  }[];
};

const cents = (value: number | string): number => Math.round(Number(value) * 100);

// Вхідні дані балансу працівника (посади з розкладом і схвалені записи) для сторінок і дій. Читання йде клієнтом
// користувача й функцією бази з перевіркою доступу всередині.
export async function loadBalanceInputs(supabase: SupabaseClient<Database>, employeeId: string): Promise<BalanceInputs> {
  const { data, error } = await supabase.rpc("employee_balance_inputs", { p_employee_id: employeeId });
  if (error) {
    // 42501 — відмова за правами: баланс не показуємо.
    if (error.code === "42501") {
      throw new BalanceDeniedError();
    }
    throw new Error(`loadBalanceInputs failed: ${error.code ?? "unknown"}`);
  }
  const raw = data as unknown as RawInputs;

  const positions: Position[] = raw.positions.map((position) => ({
    id: position.id,
    kind: position.kind as PositionKind,
    division: position.division,
    jobTitle: position.job_title,
    blocks: position.blocks.map((block) => ({
      weekday: block.weekday,
      startsAt: trimSeconds(block.starts_at),
      endsAt: trimSeconds(block.ends_at),
    })),
  }));
  const records: ApprovedRecord[] = raw.records.map((record) => ({
    id: record.id,
    positionId: record.position_id,
    date: record.date,
    startsAt: trimSeconds(record.starts_at),
    endsAt: trimSeconds(record.ends_at),
    leaveType: record.leave_type as LeaveType,
    paidCents: record.paid_share === null ? null : cents(record.paid_share),
    unpaidCents: cents(record.unpaid_share),
  }));
  return { positions, records };
}

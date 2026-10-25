import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { DecisionDeniedError, type DecideResult } from "./decision";
import type { EmployeeRecordRepository } from "./employee-record";
import { LeaveConflictError } from "./repository";
import { trimSeconds } from "./time";
import { createSupabaseLeaveRepository } from "./supabase-repository";
import type { LeaveType, RecordStatus } from "./types";

const ACTIVE_STATUSES = ["awaiting_decision", "returned_for_revision", "approved"];

// Адаптер порту EmployeeRecordRepository для Supabase. Читання йде клієнтом користувача (RLS), зміни — функціями
// Postgres update_leave_record_hours і cancel_leave_record, які самі перевіряють власника й статус.
export function createSupabaseEmployeeRepository(supabase: SupabaseClient<Database>): EmployeeRecordRepository {
  function mapRpcError(operation: string, error: { code?: string; message: string }): never {
    // 23P01 — exclusion_violation: leave_records_no_overlap спрацювало (гонка двох змін).
    if (error.code === "23P01") {
      throw new LeaveConflictError();
    }
    // 42501 — відмова за правами (чужий запис чи не власник).
    if (error.code === "42501") {
      throw new DecisionDeniedError("forbidden");
    }
    throw new Error(`${operation} failed: ${error.code ?? "unknown"}`);
  }

  return {
    async getOwnRecord(employeeId, recordId) {
      const { data: row, error } = await supabase
        .from("leave_records")
        .select("id, request_id, employee_id, position_id, leave_date, starts_at, ends_at, status")
        .eq("id", recordId)
        .eq("employee_id", employeeId)
        .maybeSingle();
      if (error) {
        throw new Error(`getOwnRecord failed: ${error.code ?? "unknown"}`);
      }
      if (!row) {
        return null;
      }

      const { data: request, error: requestError } = await supabase
        .from("leave_requests")
        .select("leave_type")
        .eq("id", row.request_id)
        .single();
      if (requestError) {
        throw new Error(`getOwnRecord(request) failed: ${requestError.code ?? "unknown"}`);
      }

      const positions = await createSupabaseLeaveRepository(supabase).loadPositions(employeeId);
      const position = positions.find((item) => item.id === row.position_id);
      if (!position) {
        throw new Error("getOwnRecord: position of a record is not visible");
      }

      // Інші активні записи тієї ж посади на цю дату: з ними перевіряємо перетин (сам запис не рахуємо).
      const { data: others, error: othersError } = await supabase
        .from("leave_records")
        .select("leave_date, starts_at, ends_at")
        .eq("employee_id", employeeId)
        .eq("position_id", row.position_id)
        .eq("leave_date", row.leave_date)
        .in("status", ACTIVE_STATUSES)
        .neq("id", row.id);
      if (othersError) {
        throw new Error(`getOwnRecord(others) failed: ${othersError.code ?? "unknown"}`);
      }

      return {
        record: {
          id: row.id,
          employeeId: row.employee_id,
          positionId: row.position_id,
          date: row.leave_date,
          startsAt: trimSeconds(row.starts_at),
          endsAt: trimSeconds(row.ends_at),
          status: row.status as RecordStatus,
          leaveType: request.leave_type as LeaveType,
        },
        position,
        others: others.map((other) => ({
          date: other.leave_date,
          startsAt: trimSeconds(other.starts_at),
          endsAt: trimSeconds(other.ends_at),
        })),
      };
    },

    async updateHours(recordId, startsAt, endsAt): Promise<DecideResult> {
      const { data, error } = await supabase.rpc("update_leave_record_hours", {
        p_record_id: recordId,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
      });
      if (error) {
        mapRpcError("updateHours", error);
      }
      const result = data as { ok: boolean; status: RecordStatus };
      return { ok: result.ok, status: result.status };
    },

    async cancel(recordId): Promise<DecideResult> {
      const { data, error } = await supabase.rpc("cancel_leave_record", { p_record_id: recordId });
      if (error) {
        mapRpcError("cancel", error);
      }
      const result = data as { ok: boolean; status: RecordStatus };
      return { ok: result.ok, status: result.status };
    },
  };
}

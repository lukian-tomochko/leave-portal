import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { LeaveConflictError, type LeaveRepository, type NewRequest } from "./repository";
import { positionLabel } from "./schedule";
import { trimSeconds } from "./time";
import type { LeaveType, Position, PositionKind, RecordStatus, ScheduleBlock } from "./types";

// Адаптер порту LeaveRepository для Supabase. Читання йде під RLS користувача, запис — однією функцією Postgres
// (rpc create_leave_request), тож заявка й усі записи створюються в одній транзакції.
export function createSupabaseLeaveRepository(supabase: SupabaseClient<Database>): LeaveRepository {
  return {
    async loadPositions(employeeId) {
      const { data: rows, error } = await supabase
        .from("positions")
        .select("id, kind, division, job_title")
        .eq("employee_id", employeeId);
      if (error) {
        throw new Error(`loadPositions failed: ${error.code ?? "unknown"}`);
      }
      if (rows.length === 0) {
        return [];
      }

      const { data: blockRows, error: blocksError } = await supabase
        .from("schedule_blocks")
        .select("position_id, weekday, starts_at, ends_at")
        .in(
          "position_id",
          rows.map((row) => row.id),
        );
      if (blocksError) {
        throw new Error(`loadPositions(blocks) failed: ${blocksError.code ?? "unknown"}`);
      }

      const positions: Position[] = rows.map((row) => {
        const blocks: ScheduleBlock[] = blockRows
          .filter((block) => block.position_id === row.id)
          .map((block) => ({
            weekday: block.weekday,
            startsAt: trimSeconds(block.starts_at),
            endsAt: trimSeconds(block.ends_at),
          }));
        return {
          id: row.id,
          kind: row.kind as PositionKind,
          division: row.division,
          jobTitle: row.job_title,
          blocks,
        };
      });

      // Основна посада першою.
      return positions.sort((a, b) => Number(b.kind === "main") - Number(a.kind === "main"));
    },

    async loadExistingRecords(employeeId) {
      const { data, error } = await supabase
        .from("leave_records")
        .select("position_id, leave_date, starts_at, ends_at, status")
        .eq("employee_id", employeeId)
        .in("status", ["awaiting_decision", "returned_for_revision", "approved"]);
      if (error) {
        throw new Error(`loadExistingRecords failed: ${error.code ?? "unknown"}`);
      }
      return data.map((row) => ({
        positionId: row.position_id,
        date: row.leave_date,
        startsAt: trimSeconds(row.starts_at),
        endsAt: trimSeconds(row.ends_at),
        status: row.status as RecordStatus,
      }));
    },

    async createRequest(request: NewRequest) {
      const { data, error } = await supabase.rpc("create_leave_request", {
        p_leave_type: request.leaveType,
        p_records: request.records.map((record) => ({
          position_id: record.positionId,
          leave_date: record.date,
          starts_at: record.startsAt,
          ends_at: record.endsAt,
        })),
        p_relationship: request.relationship,
        p_comment: request.comment,
      });
      if (error) {
        // 23P01 — exclusion_violation: обмеження leave_records_no_overlap спрацювало (гонка двох заявок).
        if (error.code === "23P01") {
          throw new LeaveConflictError();
        }
        throw new Error(`createRequest failed: ${error.code ?? "unknown"}`);
      }
      return data;
    },

    async listRecords(employeeId) {
      const { data: records, error } = await supabase
        .from("leave_records")
        .select("id, request_id, employee_id, position_id, leave_date, starts_at, ends_at, status")
        .eq("employee_id", employeeId)
        .order("leave_date", { ascending: false });
      if (error) {
        throw new Error(`listRecords failed: ${error.code ?? "unknown"}`);
      }
      if (records.length === 0) {
        return [];
      }

      const requestIds = [...new Set(records.map((record) => record.request_id))];
      const positionIds = [...new Set(records.map((record) => record.position_id))];

      const { data: requests, error: requestsError } = await supabase
        .from("leave_requests")
        .select("id, leave_type, comment")
        .in("id", requestIds);
      if (requestsError) {
        throw new Error(`listRecords(requests) failed: ${requestsError.code ?? "unknown"}`);
      }
      const { data: positions, error: positionsError } = await supabase
        .from("positions")
        .select("id, division, job_title")
        .in("id", positionIds);
      if (positionsError) {
        throw new Error(`listRecords(positions) failed: ${positionsError.code ?? "unknown"}`);
      }

      const requestById = new Map(requests.map((request) => [request.id, request]));
      const labelByPosition = new Map(
        positions.map((position) => [position.id, positionLabel({ division: position.division, jobTitle: position.job_title })]),
      );

      return records.map((record) => {
        // Запис без видимої заявки неможливий (FK + RLS): краще впасти, ніж показати хибний тип відпустки.
        const request = requestById.get(record.request_id);
        if (!request) {
          throw new Error("listRecords: request of a record is not visible");
        }
        return {
          id: record.id,
          employeeId: record.employee_id,
          date: record.leave_date,
          startsAt: trimSeconds(record.starts_at),
          endsAt: trimSeconds(record.ends_at),
          status: record.status as RecordStatus,
          leaveType: request.leave_type as LeaveType,
          positionLabel: labelByPosition.get(record.position_id) ?? "—",
          comment: request.comment,
        };
      });
    },
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  DecisionDeniedError,
  type ApprovalSplit,
  type Actor,
  type Decision,
  type DecisionEntry,
  type DecisionRecord,
  type DecisionRepository,
  type RecordsView,
} from "./decision";
import { positionLabel } from "./schedule";
import { trimSeconds } from "./time";
import type { LeaveType, RecordStatus } from "./types";

type RecordRow = Pick<
  Database["public"]["Tables"]["leave_records"]["Row"],
  "id" | "request_id" | "employee_id" | "position_id" | "leave_date" | "starts_at" | "ends_at" | "status"
>;

const RECORD_COLUMNS = "id, request_id, employee_id, position_id, leave_date, starts_at, ends_at, status";

const unique = <T>(values: T[]): T[] => [...new Set(values)];

// Адаптер порту DecisionRepository для Supabase. Усе читання йде клієнтом користувача, тож діє RLS (менеджер бачить
// лише записи своїх посад), а рішення — однією функцією Postgres decide_leave_record із перевіркою ролі всередині.
export function createSupabaseDecisionRepository(supabase: SupabaseClient<Database>): DecisionRepository {
  // Збирає записи з заявок, посад, профілів і журналу рішень; кожен запит під RLS.
  async function hydrate(rows: RecordRow[]): Promise<DecisionRecord[]> {
    if (rows.length === 0) {
      return [];
    }
    const requestIds = unique(rows.map((row) => row.request_id));
    const positionIds = unique(rows.map((row) => row.position_id));
    const recordIds = rows.map((row) => row.id);

    const [requests, positions, decisions] = await Promise.all([
      supabase.from("leave_requests").select("id, leave_type, comment").in("id", requestIds),
      supabase.from("positions").select("id, division, job_title").in("id", positionIds),
      supabase
        .from("leave_decisions")
        .select("record_id, decided_by, decision, comment, decided_at")
        .in("record_id", recordIds)
        .order("decided_at", { ascending: true }),
    ]);
    if (requests.error) {
      throw new Error(`hydrate(requests) failed: ${requests.error.code ?? "unknown"}`);
    }
    if (positions.error) {
      throw new Error(`hydrate(positions) failed: ${positions.error.code ?? "unknown"}`);
    }
    if (decisions.error) {
      throw new Error(`hydrate(decisions) failed: ${decisions.error.code ?? "unknown"}`);
    }

    const profileIds = unique([...rows.map((row) => row.employee_id), ...decisions.data.map((row) => row.decided_by)]);
    const profiles = await supabase.from("profiles").select("id, full_name, email").in("id", profileIds);
    if (profiles.error) {
      throw new Error(`hydrate(profiles) failed: ${profiles.error.code ?? "unknown"}`);
    }

    const requestById = new Map(requests.data.map((row) => [row.id, row]));
    const positionById = new Map(positions.data.map((row) => [row.id, row]));
    const nameById = new Map(profiles.data.map((row) => [row.id, row.full_name ?? row.email ?? "—"]));

    return rows.map((row) => {
      // Запис без видимої заявки неможливий (FK + RLS): краще впасти, ніж показати хибний тип відпустки.
      const request = requestById.get(row.request_id);
      if (!request) {
        throw new Error("hydrate: request of a record is not visible");
      }
      const position = positionById.get(row.position_id);
      const entries: DecisionEntry[] = decisions.data
        .filter((entry) => entry.record_id === row.id)
        .map((entry) => ({
          decidedAt: entry.decided_at,
          decidedByName: nameById.get(entry.decided_by) ?? "—",
          decision: entry.decision as Decision,
          comment: entry.comment,
        }));
      return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: nameById.get(row.employee_id) ?? "—",
        positionId: row.position_id,
        positionLabel: position ? positionLabel({ division: position.division, jobTitle: position.job_title }) : "—",
        date: row.leave_date,
        startsAt: trimSeconds(row.starts_at),
        endsAt: trimSeconds(row.ends_at),
        leaveType: request.leave_type as LeaveType,
        status: row.status as RecordStatus,
        requestComment: request.comment,
        entries,
      };
    });
  }

  return {
    async listPage(actor: Actor, view: RecordsView, page: number, pageSize: number) {
      if (actor.role === "employee") {
        return { records: [], page, hasNext: false };
      }
      const awaiting = view === "awaiting";
      let query = supabase
        .from("leave_records")
        .select(RECORD_COLUMNS)
        // Стабільне сортування (id як остання ознака), щоб записи не «стрибали» між сторінками.
        .order("leave_date", { ascending: awaiting })
        .order("starts_at", { ascending: awaiting })
        .order("id", { ascending: true });
      query = awaiting ? query.eq("status", "awaiting_decision") : query.neq("status", "awaiting_decision");
      if (actor.role === "manager") {
        if (actor.managedPositionIds.length === 0) {
          return { records: [], page, hasNext: false };
        }
        query = query.in("position_id", actor.managedPositionIds);
      }
      // Беремо на один рядок більше за сторінку, щоб знати, чи є наступна.
      const offset = (page - 1) * pageSize;
      const { data, error } = await query.range(offset, offset + pageSize);
      if (error) {
        throw new Error(`listPage failed: ${error.code ?? "unknown"}`);
      }
      const hasNext = data.length > pageSize;
      return { records: await hydrate(data.slice(0, pageSize)), page, hasNext };
    },

    async getRecord(_actor: Actor, recordId: string) {
      const { data, error } = await supabase.from("leave_records").select(RECORD_COLUMNS).eq("id", recordId).maybeSingle();
      if (error) {
        throw new Error(`getRecord failed: ${error.code ?? "unknown"}`);
      }
      if (!data) {
        return null;
      }
      const [record] = await hydrate([data]);
      return record ?? null;
    },

    async decide(recordId: string, decision: Decision, comment: string | null, split?: ApprovalSplit) {
      const { data, error } = await supabase.rpc("decide_leave_record", {
        p_record_id: recordId,
        p_decision: decision,
        p_comment: comment ?? undefined,
        // Розподіл (AC-BALANCE-10, AC-BALANCE-19): частки дня; без розподілу база отримує null і 0.
        p_paid_share: split && split.paidCents !== null ? split.paidCents / 100 : undefined,
        p_unpaid_share: split ? split.unpaidCents / 100 : 0,
      });
      if (error) {
        // 42501 — відмова за правами: «own_record» (власний запис менеджера) або «forbidden» (решта).
        if (error.code === "42501") {
          throw new DecisionDeniedError(error.message.includes("own_record") ? "own_record" : "forbidden");
        }
        throw new Error(`decide failed: ${error.code ?? "unknown"}`);
      }
      const result = data as { ok: boolean; status: RecordStatus };
      return { ok: result.ok, status: result.status };
    },
  };
}

// Хто діє: id із claims, роль із profiles (ніколи з user_metadata) і посади, за які відповідає. Без профілю — null.
export async function loadActor(supabase: SupabaseClient<Database>, userId: string): Promise<Actor | null> {
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) {
    throw new Error(`loadActor failed: ${error.code ?? "unknown"}`);
  }
  if (!profile) {
    return null;
  }
  const { data: managed, error: managedError } = await supabase
    .from("position_managers")
    .select("position_id")
    .eq("manager_id", userId);
  if (managedError) {
    throw new Error(`loadActor(positions) failed: ${managedError.code ?? "unknown"}`);
  }
  return {
    id: userId,
    role: profile.role as Actor["role"],
    managedPositionIds: managed.map((row) => row.position_id),
  };
}

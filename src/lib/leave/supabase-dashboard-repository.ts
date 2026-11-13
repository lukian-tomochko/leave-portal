import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Closure } from "./closures";
import type { TeamMember, TeamRecord } from "./dashboard";
import type { Actor } from "./decision";
import { trimSeconds } from "./time";
import type { LeaveType, RecordStatus } from "./types";

// Адаптер даних дашборду й календаря для Supabase. Усе читання йде клієнтом користувача, тож діє RLS: менеджер бачить лише
// працівників і записи своїх посад, адміністратор — усіх, працівник команди не бачить. Нових функцій бази тут немає.

const unique = <T>(values: T[]): T[] => [...new Set(values)];

// Закриття шкільного календаря, що перетинають навчальний рік `year` (з 1 вересня до 31 серпня наступного).
export async function loadClosures(supabase: SupabaseClient<Database>, year: number): Promise<Closure[]> {
  const { data, error } = await supabase
    .from("school_closures")
    .select("name, starts_on, ends_on, closed_from")
    .lte("starts_on", `${year + 1}-08-31`)
    .gte("ends_on", `${year}-09-01`);
  if (error) {
    throw new Error(`closures failed: ${error.code ?? "unknown"}`);
  }
  return (data ?? []).map((row) => ({
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    closedFrom: row.closed_from === null ? null : trimSeconds(row.closed_from),
  }));
}

const PAGE = 1000;

// Записи команди за навчальний рік і ще місяць після нього (теплова карта дивиться на три тижні вперед, тож наприкінці серпня
// вікно заходить у вересень). Сторінками по 1000 зі стабільним сортуванням за id: PostgREST віддає не більше свого ліміту за запит.
async function loadTeamRecords(supabase: SupabaseClient<Database>, employeeIds: string[], year: number) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("leave_records")
      .select("id, employee_id, leave_date, status, leave_requests!leave_records_request_id_fkey(leave_type)")
      .in("employee_id", employeeIds)
      .gte("leave_date", `${year}-09-01`)
      .lte("leave_date", `${year + 1}-09-30`)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) {
      throw new Error(`team(records) failed: ${error.code ?? "unknown"}`);
    }
    rows.push(...data);
    if (data.length < PAGE) {
      return rows;
    }
  }
}

export type TeamData = { team: TeamMember[]; records: TeamRecord[] };

// Працівники, яких бачить менеджер чи адміністратор (без нього самого), і їхні записи за навчальний рік.
export async function loadTeam(supabase: SupabaseClient<Database>, actor: Actor, year: number): Promise<TeamData> {
  if (actor.role === "employee" || (actor.role === "manager" && actor.managedPositionIds.length === 0)) {
    return { team: [], records: [] };
  }

  let positions = supabase.from("positions").select("id, employee_id");
  if (actor.role === "manager") {
    positions = positions.in("id", actor.managedPositionIds);
  }
  const { data: positionRows, error: positionsError } = await positions;
  if (positionsError) {
    throw new Error(`team(positions) failed: ${positionsError.code ?? "unknown"}`);
  }
  const employeeIds = unique((positionRows ?? []).map((row) => row.employee_id)).filter((id) => id !== actor.id);
  if (employeeIds.length === 0) {
    return { team: [], records: [] };
  }

  const [profiles, records] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", employeeIds),
    loadTeamRecords(supabase, employeeIds, year),
  ]);
  if (profiles.error) {
    throw new Error(`team(profiles) failed: ${profiles.error.code ?? "unknown"}`);
  }

  const team: TeamMember[] = (profiles.data ?? [])
    .map((row) => ({ id: row.id, name: row.full_name ?? row.email ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));

  return {
    team,
    records: records.flatMap((row) => {
      // Запис без видимої заявки неможливий (FK + RLS); пропускаємо, а не вгадуємо тип відпустки.
      const request = Array.isArray(row.leave_requests) ? row.leave_requests[0] : row.leave_requests;
      return request
        ? [
            {
              employeeId: row.employee_id,
              date: row.leave_date,
              status: row.status as RecordStatus,
              leaveType: request.leave_type as LeaveType,
            },
          ]
        : [];
    }),
  };
}

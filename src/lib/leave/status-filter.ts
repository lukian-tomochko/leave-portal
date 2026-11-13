import { RECORD_STATUSES, type RecordStatus } from "./types";

// Статус із параметра ?status= («My requests»): відомий статус або null («Усі»); сміття в адресі ігноруємо.
export function parseStatusFilter(value: string | string[] | undefined): RecordStatus | null {
  const text = Array.isArray(value) ? value[0] : value;
  return RECORD_STATUSES.find((status) => status === text) ?? null;
}

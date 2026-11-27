import type { RequestInput } from "./types";

// Ключ значень форми «Нова заявка»: за ним відрізняємо підсумок, порахований сервером для поточних значень, від застарілого.
// Ключ збираємо з МАСИВУ, а не з об'єкта: порядок значень задано тут, а не порядком полів у викликах. Раніше обидва ключі
// будувались з об'єктів із різним порядком полів, JSON-рядки ніколи не збігались, і підсумок після «Show summary» не
// показувався (відхилення issue 104, AC-LEAVE-01).

export type FormMode = "whole-day" | "hours";

export type FormKeyValues = {
  leaveType: string;
  dates: string[];
  positionIds: string[];
  mode: FormMode;
  startsAt: string;
  endsAt: string;
  relationship: string;
  comment: string;
};

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort();

export function formKey(values: FormKeyValues): string {
  return JSON.stringify([
    values.leaveType,
    uniqueSorted(values.dates),
    uniqueSorted(values.positionIds),
    values.mode,
    values.startsAt,
    values.endsAt,
    values.relationship,
    values.comment,
  ]);
}

// Ключ значень, з якими сервер порахував підсумок (форма подання відправляє їх знову): та сама функція, що й для форми.
export function summaryKey(values: RequestInput): string {
  return formKey({
    leaveType: values.leaveType,
    dates: values.dates,
    positionIds: values.positionIds,
    mode: values.hours ? "hours" : "whole-day",
    startsAt: values.hours?.startsAt ?? "",
    endsAt: values.hours?.endsAt ?? "",
    relationship: values.relationship ?? "",
    comment: (values.comment ?? "").trim(),
  });
}

// Стани форм помічника календаря (useActionState). Лише типи: файл із "use server" не може експортувати нічого, крім дій.
export type SuggestionRow = {
  key: string;
  name: string;
  kind: "whole" | "early";
  startsOn: string; // для скороченого дня це єдина дата
  endsOn: string;
  time: string; // "HH:MM" для скороченого дня, інакше ""
};

export type AssistantState =
  | { status: "idle" }
  | { status: "suggested"; requestId: number; rows: SuggestionRow[] }
  // needs_info, refused, unavailable, text_too_long, error — повідомлення з AC, нічого не запропоновано.
  | { status: "message"; kind: "needs_info" | "refused" | "unavailable" | "too_long" | "error"; message: string };

export type RowResult = { key: string; ok: boolean; message?: string };
export type SaveState = { status: "idle" } | { status: "done"; results: RowResult[] } | { status: "error"; message: string };

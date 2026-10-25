// Стан форм власника запису (useActionState). Лише типи: файл із "use server" не може експортувати нічого, крім дій.
export type RecordActionState = { status: "idle" } | { status: "error"; message: string };

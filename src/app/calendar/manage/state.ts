// Стан форм керування календарем (useActionState). Лише типи: файл із "use server" не може експортувати нічого, крім дій.
export type ClosureFormState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

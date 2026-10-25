// Стан форми рішення (useActionState). Лише типи: файл із "use server" не може експортувати нічого, крім дій.
export type DecisionFormState = { status: "idle" } | { status: "error"; message: string };

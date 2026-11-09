// Стан форм керування календарем (useActionState). Лише типи: файл із "use server" не може експортувати нічого, крім дій.
// values — що ввів адміністратор: після помилки форма лишає введене (React 19 скидає неконтрольовану форму після дії,
// тож поля беруть defaultValue з цього стану, DESIGN.md: «введене лишається у формі»).
export type ClosureFormValues = { name: string; startsOn: string; endsOn: string; date: string; time: string };
export type ClosureFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string; values?: ClosureFormValues };

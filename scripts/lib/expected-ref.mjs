// Звірка supabaseRef із /api/health з очікуваним ref середовища (дія з postmortem 2026-11-26-staging-supabase-url).
// Ref — частина публічної адреси проєкту Supabase, не секрет. Очікуваний ref задає workflow зі змінних репо:
// SUPABASE_PROD_REF для проду, SUPABASE_STAGING_REF для staging і preview. Хибна NEXT_PUBLIC_SUPABASE_URL (чужий,
// неіснуючий чи прод-ref у preview) тепер називається прямо, а не «Supabase недоступний чи URL не той?».

/** Опис проблеми ("" — усе гаразд або перевірка не задана). `actual === undefined` — відповідь без поля supabaseRef. */
export function supabaseRefProblem(actual, expected) {
  const want = String(expected ?? "").trim().toLowerCase();
  if (!want || actual === undefined || actual === null) return "";
  const got = String(actual).trim().toLowerCase();
  if (got === want) return "";
  if (!got) {
    return "supabaseRef порожній: NEXT_PUBLIC_SUPABASE_URL відсутня чи не є адресою https://<ref>.supabase.co (Vercel → Environment Variables для цього середовища)";
  }
  return `supabaseRef=${got} не збігається з очікуваним ${want} для цього середовища: перевірте NEXT_PUBLIC_SUPABASE_URL у Vercel (Preview і гілка staging — база staging, Production — база проду)`;
}

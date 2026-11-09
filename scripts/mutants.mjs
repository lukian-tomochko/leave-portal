// Мутанти для scripts/mutation-check.mjs (npm run mutation:sql). Мутант = одне правило з AC, навмисно зламане.
// Джерело формату — демо-репо курсу, scripts/mutants.mjs (тег ws8-02-tests).
// Поля:
//   id, kind ("sql" | "ts"), ac (який AC це правило доводить), what (що зламано — людською мовою);
//   file — що мутуємо; tests — файли тестів, які мають довести правило (саме їх і запускаємо);
//   find — рядок або RegExp, що трапляється у файлі РІВНО один раз (надійніше за номери рядків, які зсуваються);
//   replace — заміна (вставляється буквально: «$$» у plpgsql лишається «$$»);
//   expect: "survive" + reason — лише для еквівалентного мутанта (поведінка не змінюється) з посиланням на те,
//   що робить його еквівалентним. Без reason скрипт мутант не приймає.
// Новий AC з відмовою, правило якого живе в SQL (політика, grant, функція, тригер), — новий мутант тут.
//
// Наші мутанти — на правила SQL за AC, які ми доводимо у WS8 (docs/qa/proof-pack.md): AC-DECIDE-12, AC-BALANCE-13 і (додатково) AC-DECIDE-08.
// Правило AC-DECIDE-14 (порожній список) живе в TS (src/lib/leave/decision.ts) — його перевіряє Stryker (npm run mutation:ts).
const DECIDE = "supabase/migrations/20261027090000_leave_balance.sql";
const DECISION_DB = "tests/db/leave-decision.test.ts";
const BALANCE_DB = "tests/db/leave-balance.test.ts";
const HOURS_END = "supabase/migrations/20261109090000_leave_hours_end_at_block_start.sql";
const REQUEST_DB = "tests/db/leave-request.test.ts";
const CLOSURES = "supabase/migrations/20261109120000_school_closures.sql";
const CLOSURES_DB = "tests/db/school-calendar.test.ts";

export const mutants = [
  {
    id: "S1", kind: "sql", ac: "AC-DECIDE-08", file: DECIDE, tests: [DECISION_DB],
    what: "decide_leave_record: прибрано обидві перевірки відповідальності за посаду (менеджер чужої посади вирішує запис)",
    // Перевірка стоїть двічі: перед блокуванням і після for share. Мутант знімає обидві одразу: кожна окремо
    // еквівалентна (див. S1b), і мутант лише на одну лишився б живим без пояснення. Перевірку власного запису
    // (own_record) мутант зберігає.
    find: new RegExp(
      String.raw`    if not exists \(\n      select 1 from public\.position_managers as m[\s\S]*?` +
        String.raw`    for share;\n    if not found then\n      raise exception 'forbidden' using errcode = '42501';\n    end if;\n  end if;\n`,
    ),
    replace:
      "    if v_owner = v_uid then\n      raise exception 'own_record' using errcode = '42501';\n    end if;\n  end if;\n",
  },
  {
    id: "S1b", kind: "sql", ac: "AC-DECIDE-08", file: DECIDE, tests: [DECISION_DB],
    what: "decide_leave_record: прибрано другу перевірку відповідальності (після for share)",
    expect: "survive",
    reason:
      "еквівалентний: перша перевірка (перед блокуванням, «if not exists (select 1 from public.position_managers …)») " +
      "вже відхиляє менеджера чужої посади; друга лише фіксує призначення блокуванням for share",
    find: "    for share;\n    if not found then\n      raise exception 'forbidden' using errcode = '42501';\n    end if;\n  end if;\n",
    replace: "    for share;\n  end if;\n",
  },
  {
    id: "S2", kind: "sql", ac: "AC-DECIDE-12", file: HOURS_END, tests: [DECISION_DB],
    what: "update_leave_record_hours: схвалений запис теж можна змінити (статус approved у переліку дозволених)",
    find: "v_record.status not in ('awaiting_decision', 'returned_for_revision')",
    replace: "v_record.status not in ('awaiting_decision', 'returned_for_revision', 'approved')",
  },
  {
    id: "S3", kind: "sql", ac: "AC-BALANCE-13", file: DECIDE, tests: [BALANCE_DB],
    what: "employee_balance_inputs: будь-який користувач з входом отримує баланс будь-якого працівника (умова «сам працівник» завжди істинна)",
    find: "    v_uid = p_employee_id\n    or (select private.current_app_role()) = 'admin'",
    replace: "    true\n    or (select private.current_app_role()) = 'admin'",
  },
  {
    id: "S4", kind: "sql", ac: "AC-LEAVE-22", file: HOURS_END, tests: [REQUEST_DB],
    what: "create_leave_request_impl: кінець відпустки більше не може дорівнювати початку наступного блоку (09:00–12:30 знову відхиляється)",
    find: " or v_ends = b.starts_at",
    replace: "",
  },
  {
    id: "S5", kind: "sql", ac: "AC-LEAVE-22", file: HOURS_END, tests: [REQUEST_DB],
    what: "update_leave_record_hours: зміна годин із кінцем на початку наступного блоку знову відхиляється",
    find: " or p_ends_at = b.starts_at",
    replace: "",
  },
  {
    id: "S6", kind: "sql", ac: "AC-CAL-13", file: CLOSURES, tests: [CLOSURES_DB],
    what: "add_school_closure: прибрано перевірку ролі admin (менеджер чи працівник напряму додає закриття)",
    find:
      "  if (select private.current_app_role()) is distinct from 'admin' then\n" +
      "    raise exception 'forbidden' using errcode = '42501';\n" +
      "  end if;\n" +
      "  if p_starts_on is null",
    replace: "  if p_starts_on is null",
  },
  {
    id: "S7", kind: "sql", ac: "AC-CAL-09", file: CLOSURES, tests: [CLOSURES_DB],
    what: "remove_school_closure: прибрано перевірку ролі admin (будь-хто з входом видаляє закриття)",
    find:
      "  if (select private.current_app_role()) is distinct from 'admin' then\n" +
      "    raise exception 'forbidden' using errcode = '42501';\n" +
      "  end if;\n\n" +
      "  perform pg_advisory_xact_lock(hashtext('school_closures'));\n\n" +
      "  delete",
    replace: "  perform pg_advisory_xact_lock(hashtext('school_closures'));\n\n  delete",
  },
  {
    id: "S8", kind: "sql", ac: "AC-CAL-13", file: CLOSURES, tests: [CLOSURES_DB],
    what: "school_closures: authenticated отримує прямі insert і delete на таблицю (обхід функцій)",
    find: "grant select on table public.school_closures to authenticated;",
    replace: "grant select, insert, delete on table public.school_closures to authenticated;",
  },
  {
    id: "S9", kind: "sql", ac: "AC-CAL-07", file: CLOSURES, tests: [CLOSURES_DB],
    what: "add_school_closure: погоджений запис більше не блокує закриття дня (статус approved прибрано з блокуючих)",
    find: "      and r.status in ('awaiting_decision', 'returned_for_revision', 'approved')",
    replace: "      and r.status in ('awaiting_decision', 'returned_for_revision')",
  },
  {
    id: "S10", kind: "sql", ac: "AC-CAL-08", file: CLOSURES, tests: [CLOSURES_DB],
    what: "add_school_closure: відхилений запис теж блокує закриття (статус rejected додано до блокуючих)",
    find: "      and r.status in ('awaiting_decision', 'returned_for_revision', 'approved')",
    replace: "      and r.status in ('awaiting_decision', 'returned_for_revision', 'approved', 'rejected')",
  },
  {
    id: "S11", kind: "sql", ac: "AC-CAL-10", file: CLOSURES, tests: [CLOSURES_DB],
    what: "add_school_closure: прибрано перевірку «кінець не раніше початку» (замість відповіді — помилка обмеження)",
    find: "  if p_ends_on < p_starts_on then",
    replace: "  if false then",
  },
  {
    id: "S12", kind: "sql", ac: "AC-CAL-11", file: CLOSURES, tests: [CLOSURES_DB],
    what: "add_school_closure: прибрано відповідь про перетин із закриттям (лишається лише обмеження виключення)",
    find: "  if jsonb_array_length(v_overlaps) > 0 then",
    replace: "  if false then",
  },
  {
    id: "S13", kind: "sql", ac: "AC-CAL-07", file: CLOSURES, tests: [CLOSURES_DB],
    what: "add_school_closure: для скороченого дня блокують усі записи дня, а не лише ті, що мають хвилини після часу закриття",
    find: "greatest(r.starts_at, sb.starts_at, p_closed_from)",
    replace: "greatest(r.starts_at, sb.starts_at)",
  },
];

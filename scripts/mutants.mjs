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
const HOURS = "supabase/migrations/20261026080000_leave_hours_in_schedule.sql";
const DECISION_DB = "tests/db/leave-decision.test.ts";
const BALANCE_DB = "tests/db/leave-balance.test.ts";

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
    id: "S2", kind: "sql", ac: "AC-DECIDE-12", file: HOURS, tests: [DECISION_DB],
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
];

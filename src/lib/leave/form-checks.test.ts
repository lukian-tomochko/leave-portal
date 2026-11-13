import { describe, expect, it } from "vitest";
import type { Closure } from "./closures";
import { dateError, hoursStepError, positionsError, type FormPosition } from "./form-checks";

// Дані з прикладів PM (requirements/01-leave-request.md): основна посада пн–пт, додаткова лише в понеділок.
// 2026-11-02 — понеділок, 2026-11-07 — субота.
const MAIN: FormPosition = { id: "main", weekdays: [1, 2, 3, 4, 5] };
const ADDITIONAL: FormPosition = { id: "additional", weekdays: [1] };
const POSITIONS = [MAIN, ADDITIONAL];

describe("перевірки форми «Нова заявка»", () => {
  it("AC-LEAVE-10: жодної посади — форма показує «Choose at least one position», а не «немає годин»", () => {
    expect(positionsError([])).toBe("Choose at least one position");
    // Дата 2026-11-02 обрана, посади виключено: біля дати помилки немає, текст дає перевірка посад.
    expect(dateError("2026-11-02", POSITIONS, [])).toBeNull();
  });

  it("AC-LEAVE-10: з обраною посадою перевірка посад помилки не дає", () => {
    expect(positionsError(["main"])).toBeNull();
  });

  it("AC-LEAVE-06: субота без розкладу в обраних посадах — «You have no working hours on this day»", () => {
    expect(dateError("2026-11-07", POSITIONS, ["main", "additional"])).toBe("You have no working hours on this day");
  });

  it("AC-LEAVE-06: день, у який працює хоча б одна обрана посада, помилки не дає", () => {
    // Вівторок 2026-11-03: додаткова посада не працює, основна працює.
    expect(dateError("2026-11-03", POSITIONS, ["main", "additional"])).toBeNull();
    // Але лише додаткова посада у вівторок — розкладу немає.
    expect(dateError("2026-11-03", POSITIONS, ["additional"])).toBe("You have no working hours on this day");
  });

  it("порожня чи некоректна дата не кидає виняток і помилки біля поля не дає", () => {
    expect(dateError("", POSITIONS, ["main"])).toBeNull();
    expect(dateError("2026-02-31", POSITIONS, ["main"])).toBeNull();
    expect(dateError("0000-00-00", POSITIONS, ["main"])).toBeNull();
  });

  // Закриття шкільного календаря (requirements/04-school-calendar.md): 2026-12-29 — вівторок, 2027-01-02 — субота.
  const WINTER_BREAK: Closure = { name: "Winter break", startsOn: "2026-12-28", endsOn: "2027-01-08", closedFrom: null };
  const EARLY_DISMISSAL: Closure = { name: "Teachers' meeting", startsOn: "2026-11-20", endsOn: "2026-11-20", closedFrom: "12:00" };

  it("AC-CAL-03: вівторок 2026-12-29 у «Winter break» — «The school is closed on this day: Winter break»", () => {
    expect(dateError("2026-12-29", POSITIONS, ["main"], [WINTER_BREAK])).toBe("The school is closed on this day: Winter break");
  });

  it("AC-CAL-03: перший і останній день закриття теж закриті, а день поза ним — ні", () => {
    expect(dateError("2026-12-28", POSITIONS, ["main"], [WINTER_BREAK])).toBe("The school is closed on this day: Winter break");
    expect(dateError("2027-01-08", POSITIONS, ["main"], [WINTER_BREAK])).toBe("The school is closed on this day: Winter break");
    expect(dateError("2027-01-11", POSITIONS, ["main"], [WINTER_BREAK])).toBeNull();
  });

  it("AC-CAL-03: субота всередині закриття лишається «You have no working hours on this day»: закриття змінює лише робочі дні", () => {
    expect(dateError("2027-01-02", POSITIONS, ["main"], [WINTER_BREAK])).toBe("You have no working hours on this day");
  });

  it("AC-CAL-04: скорочений день форма не відхиляє: відкриті блоки до 12:00 лишаються", () => {
    expect(dateError("2026-11-20", POSITIONS, ["main"], [EARLY_DISMISSAL])).toBeNull();
  });
});

describe("години з кроком 5 хвилин", () => {
  it("кратні п'яти хвилини приймаємо, інші дають підказку замість технічної помилки сервера", () => {
    expect(hoursStepError("09:00", "12:35")).toBeNull();
    expect(hoursStepError("17:17", "18:18")).toBe("Minutes must be a multiple of 5 (00, 05, 10…), for example 09:05 or 12:30");
    expect(hoursStepError("09:00", "10:03")).not.toBeNull();
  });

  it("порожній час поки не оцінюємо: поле саме вимагає значення", () => {
    expect(hoursStepError("", "")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { dateError, positionsError, type FormPosition } from "./form-checks";

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
});

import { describe, expect, it } from "vitest";
import { clickDay, expandRange } from "./date-selection";

const weekdaysOnly = (date: string) => ![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());

describe("діапазон дат у календарі заявки", () => {
  it("розгортає діапазон у будь-якому порядку включно з кінцями й через межу місяця", () => {
    expect(expandRange("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
    expect(expandRange("2026-12-02", "2026-11-30")).toEqual(["2026-11-30", "2026-12-01", "2026-12-02"]);
    expect(expandRange("2026-11-18", "2026-11-18")).toEqual(["2026-11-18"]);
  });

  it("перший клік додає день і ставить якір; повторний клік по ньому скидає якір, день лишається", () => {
    const first = clickDay([""], null, "2026-11-18", weekdaysOnly);
    expect(first).toEqual({ dates: ["2026-11-18"], anchor: "2026-11-18" });
    expect(clickDay(first.dates, first.anchor, "2026-11-18", weekdaysOnly)).toEqual({ dates: ["2026-11-18"], anchor: null });
  });

  it("другий клік додає діапазон без вихідних, але сам кінцевий день лишає, навіть якщо він вихідний", () => {
    const first = clickDay([""], null, "2026-11-20", weekdaysOnly);
    const second = clickDay(first.dates, first.anchor, "2026-11-22", weekdaysOnly);
    expect(second).toEqual({ dates: ["2026-11-20", "2026-11-22"], anchor: null });
    const third = clickDay(["2026-11-20"], "2026-11-20", "2026-11-25", weekdaysOnly);
    expect(third.dates).toEqual(["2026-11-20", "2026-11-23", "2026-11-24", "2026-11-25"]);
  });

  it("клік по вже вибраному дню без якоря прибирає його; порожній список повертає порожнє поле", () => {
    expect(clickDay(["2026-11-18"], null, "2026-11-18", weekdaysOnly)).toEqual({ dates: [""], anchor: null });
    expect(clickDay(["2026-11-18", "2026-11-19"], null, "2026-11-18", weekdaysOnly).dates).toEqual(["2026-11-19"]);
  });

  it("діапазон не дублює вже вибрані дати", () => {
    const result = clickDay(["2026-11-18", "2026-11-19"], "2026-11-18", "2026-11-20", weekdaysOnly);
    expect(result.dates).toEqual(["2026-11-18", "2026-11-19", "2026-11-20"]);
  });
});

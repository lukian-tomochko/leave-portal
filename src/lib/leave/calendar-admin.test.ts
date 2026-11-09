import { describe, expect, it } from "vitest";
import { addClosureMessage, parseClosureForm, removeClosureMessage } from "./calendar-admin";
import { alreadyClosed, closureBlocked } from "./messages";

const whole = (over: Partial<Record<string, string>> = {}) => ({
  kind: "whole",
  name: "Winter break",
  startsOn: "2026-12-28",
  endsOn: "2027-01-08",
  date: "",
  time: "",
  ...over,
});

describe("форма закриття календаря", () => {
  it("AC-CAL-01: цілі дні 2026-12-28 – 2027-01-08 з назвою «Winter break» дають закриття без часу", () => {
    expect(parseClosureForm(whole())).toEqual({
      ok: true,
      input: { name: "Winter break", startsOn: "2026-12-28", endsOn: "2027-01-08", closedFrom: null },
    });
  });

  it("AC-CAL-01: скорочений день бере одну дату й час закриття", () => {
    expect(parseClosureForm({ kind: "early", name: "Teachers' meeting", startsOn: "", endsOn: "", date: "2026-11-20", time: "12:00" })).toEqual({
      ok: true,
      input: { name: "Teachers' meeting", startsOn: "2026-11-20", endsOn: "2026-11-20", closedFrom: "12:00" },
    });
  });

  it("AC-CAL-10: кінцева дата 2026-12-28 раніше за початкову 2027-01-08 дає «The end date cannot be earlier than the start date»", () => {
    expect(parseClosureForm(whole({ startsOn: "2027-01-08", endsOn: "2026-12-28" }))).toEqual({
      ok: false,
      message: "The end date cannot be earlier than the start date",
    });
  });

  it("AC-CAL-10: закриття на один день (початок = кінець) приймається", () => {
    expect(parseClosureForm(whole({ startsOn: "2026-12-28", endsOn: "2026-12-28" })).ok).toBe(true);
  });

  it("порожня чи задовга назва, некоректна дата й час не кратний 5 хвилинам відхиляються без запиту до бази", () => {
    expect(parseClosureForm(whole({ name: "   " })).ok).toBe(false);
    expect(parseClosureForm(whole({ name: "x".repeat(101) })).ok).toBe(false);
    expect(parseClosureForm(whole({ startsOn: "" })).ok).toBe(false);
    expect(parseClosureForm(whole({ endsOn: "2026-13-01" })).ok).toBe(false);
    const early = { kind: "early", name: "Meeting", startsOn: "", endsOn: "", date: "2026-11-20" };
    expect(parseClosureForm({ ...early, time: "12:03" }).ok).toBe(false);
    expect(parseClosureForm({ ...early, time: "00:00" }).ok).toBe(false);
    expect(parseClosureForm({ ...early, time: "" }).ok).toBe(false);
    expect(parseClosureForm({ ...early, time: "12:05" }).ok).toBe(true);
  });
});

describe("відповіді бази на додавання й видалення закриття", () => {
  it("AC-CAL-07: записи, що блокують, — «These days have leave records and cannot be closed: 2026-12-29 teacher1@example.test»", () => {
    const result = { ok: false, code: "blocked", records: [{ date: "2026-12-29", email: "teacher1@example.test" }] };

    expect(addClosureMessage(result)).toBe("These days have leave records and cannot be closed: 2026-12-29 teacher1@example.test");
  });

  it("AC-CAL-07: кілька записів у повідомленні — пари «дата email» через «, » за датами", () => {
    expect(
      closureBlocked([
        { date: "2026-12-29", email: "teacher1@example.test" },
        { date: "2026-12-30", email: "teacher2@example.test" },
      ]),
    ).toBe("These days have leave records and cannot be closed: 2026-12-29 teacher1@example.test, 2026-12-30 teacher2@example.test");
  });

  it("AC-CAL-11: перетин — «2026-12-30 is already closed: Winter break»", () => {
    const result = { ok: false, code: "overlap", overlaps: [{ date: "2026-12-30", name: "Winter break" }] };

    expect(addClosureMessage(result)).toBe("2026-12-30 is already closed: Winter break");
    expect(alreadyClosed([{ date: "2026-12-30", name: "Winter break" }])).toBe("2026-12-30 is already closed: Winter break");
  });

  it("AC-CAL-10: код end_before_start дає те саме повідомлення, що й форма", () => {
    expect(addClosureMessage({ ok: false, code: "end_before_start" })).toBe("The end date cannot be earlier than the start date");
  });

  it("успіх не дає повідомлення, а невідомий код — технічну помилку", () => {
    expect(addClosureMessage({ ok: true, id: "1" })).toBeNull();
    expect(addClosureMessage({ ok: false, code: "something_new" })).toMatch(/Не вдалося/);
    expect(addClosureMessage(null)).toMatch(/Не вдалося/);
    expect(removeClosureMessage({ ok: true })).toBeNull();
    expect(removeClosureMessage({ ok: false, code: "not_found" })).toMatch(/вже видалено/);
  });

  it("відмови бази за назвою й часом, а також порожні списки перетинів чи записів дають зрозумілі повідомлення", () => {
    expect(addClosureMessage({ ok: false, code: "name_empty" })).toBe("Вкажіть назву закриття");
    expect(addClosureMessage({ ok: false, code: "name_too_long" })).toMatch(/100 символів/);
    expect(addClosureMessage({ ok: false, code: "invalid_time" })).toMatch(/кроком 5 хвилин/);
    expect(addClosureMessage({ ok: false, code: "overlap", overlaps: [] })).toMatch(/Не вдалося/);
    expect(addClosureMessage({ ok: false, code: "blocked" })).toMatch(/Не вдалося/);
    expect(removeClosureMessage({ ok: false, code: "other" })).toMatch(/Не вдалося/);
    expect(removeClosureMessage("x")).toMatch(/Не вдалося/);
  });

  it("час закриття 25:99 у правильній формі, але неіснуючий, відхиляється", () => {
    const early = { kind: "early", name: "Meeting", startsOn: "", endsOn: "", date: "2026-11-20", time: "25:99" };

    expect(parseClosureForm(early).ok).toBe(false);
    expect(parseClosureForm({ ...early, date: "2026-02-30", time: "12:00" }).ok).toBe(false);
  });
});

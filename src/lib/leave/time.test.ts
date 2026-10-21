import { describe, expect, it } from "vitest";
import { blocksOn, wholeDay } from "./schedule";
import { formatDuration, formatTime, isValidDate, parseTime, trimSeconds, weekdayOf } from "./time";
import type { Position } from "./types";

describe("time", () => {
  it("розбирає й форматує час", () => {
    expect(parseTime("08:30")).toBe(510);
    expect(formatTime(510)).toBe("08:30");
    expect(() => parseTime("8:30")).toThrow(RangeError);
    expect(trimSeconds("08:30:00")).toBe("08:30");
  });

  it("рахує день тижня цивільної дати: понеділок = 1, неділя = 7", () => {
    expect(weekdayOf("2026-11-02")).toBe(1);
    expect(weekdayOf("2026-11-07")).toBe(6);
    expect(weekdayOf("2026-11-08")).toBe(7);
  });

  it("перевіряє існування дати", () => {
    expect(isValidDate("2026-11-02")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("02.11.2026")).toBe(false);
  });

  it("форматує тривалість у стилі PM", () => {
    expect(formatDuration(150)).toBe("2 h 30 min");
    expect(formatDuration(420)).toBe("7 h");
    expect(formatDuration(45)).toBe("45 min");
  });
});

describe("schedule", () => {
  const withGap: Position = {
    id: "p",
    kind: "main",
    division: "Elementary school",
    jobTitle: "Teacher",
    blocks: [
      { weekday: 2, startsAt: "12:30", endsAt: "15:30" },
      { weekday: 2, startsAt: "08:30", endsAt: "12:00" },
      { weekday: 3, startsAt: "08:30", endsAt: "15:30" },
    ],
  };

  it("повертає блоки дня за часом початку", () => {
    expect(blocksOn(withGap, "2026-11-03").map((block) => block.startsAt)).toEqual(["08:30", "12:30"]);
    expect(blocksOn(withGap, "2026-11-07")).toEqual([]);
  });

  it("цілий день з проміжком: від першого початку до останнього кінця, хвилини лише в блоках", () => {
    expect(wholeDay(blocksOn(withGap, "2026-11-03"))).toEqual({ startsAt: "08:30", endsAt: "15:30", minutes: 390 });
  });
});

import { describe, expect, it } from "vitest";
import { parseStatusFilter } from "./status-filter";

describe("фільтр статусу в адресі", () => {
  it("приймає відомий статус, першим із масиву", () => {
    expect(parseStatusFilter("approved")).toBe("approved");
    expect(parseStatusFilter(["rejected", "approved"])).toBe("rejected");
  });

  it("невідоме значення чи його відсутність — без фільтра", () => {
    expect(parseStatusFilter("pending")).toBeNull();
    expect(parseStatusFilter("")).toBeNull();
    expect(parseStatusFilter(undefined)).toBeNull();
  });
});

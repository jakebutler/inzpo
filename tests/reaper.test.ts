import { describe, expect, it } from "vitest";
import { selectExpiredTmp, TMP_PREFIX, TMP_MAX_AGE_MS } from "@/lib/reaper";

const NOW = new Date("2026-09-14T12:00:00Z");

function age(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

describe("selectExpiredTmp", () => {
  it("selects only tmp/ objects older than 24h", () => {
    const objects = [
      { key: "tmp/old.jpg", lastModified: age(25) },
      { key: "tmp/fresh.png", lastModified: age(1) },
      { key: "items/01ABC/original.jpg", lastModified: age(72) },
    ];
    expect(selectExpiredTmp(objects, NOW)).toEqual(["tmp/old.jpg"]);
  });

  it("uses a strict cutoff: exactly 24h stays, a millisecond more goes", () => {
    const exact = { key: "tmp/exact.jpg", lastModified: age(24) };
    const justOver = { key: "tmp/justover.jpg", lastModified: new Date(age(24).getTime() - 1) };
    expect(selectExpiredTmp([exact, justOver], NOW)).toEqual(["tmp/justover.jpg"]);
    expect(TMP_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
    expect(TMP_PREFIX).toBe("tmp/");
  });

  it("skips objects without a timestamp", () => {
    expect(selectExpiredTmp([{ key: "tmp/notime.jpg" }, { key: "tmp/old.jpg", lastModified: age(48) }], NOW)).toEqual([
      "tmp/old.jpg",
    ]);
  });

  it("honors a custom cutoff", () => {
    const objects = [{ key: "tmp/a.jpg", lastModified: age(2) }];
    expect(selectExpiredTmp(objects, NOW, 60 * 60 * 1000)).toEqual(["tmp/a.jpg"]);
    expect(selectExpiredTmp(objects, NOW, 3 * 60 * 60 * 1000)).toEqual([]);
  });
});

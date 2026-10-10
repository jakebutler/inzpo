import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { pairwiseRoleDeltaE, ROLE_DELTA_E_METRIC } from "@/lib/color-distance";

it("audits live role maps and sample-report rows with CIE76, ignoring empty roles", async () => {
  const dir = mkdtempSync(join(tmpdir(), "inzpo-palette-delta-e-"));
  const originalArgv = process.argv;
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const path = join(dir, "live.json");
    const live = { primary: "#a0adbb", secondary: "#8cadc3", background: "#79acd3", text: null };
    writeFileSync(path, JSON.stringify({ photos: [
      { photo: "IMG_6208", roles: live },
      { photo: "IMG_6505", roles: [{ role: "primary", hex: "#d5d2aa" },
        { role: "text", hex: "#020505" }, { role: "accent", hex: null }] },
      { photo: "CIE76-distinct", roles: { primary: "#888888", background: "#aaaaaa", accent: null } },
    ] }));
    process.argv = [process.execPath, "scripts/palette-delta-e.mts", path];
    const scriptPath = "../scripts/palette-delta-e.mts";
    await import(scriptPath);
    const report = JSON.parse(log.mock.calls[0][0]);
    expect(report.deltaEMetric).toContain(ROLE_DELTA_E_METRIC);
    expect(report.minimumRoleDeltaE).toBe(12);
    expect(report.photos[0]).toMatchObject({ photo: "IMG_6208", filledRoleCount: 3, passes: false });
    expect(report.photos[0].pairs).toEqual(pairwiseRoleDeltaE(live));
    expect(report.photos[1]).toMatchObject({ photo: "IMG_6505", filledRoleCount: 2, passes: true });
    expect(report.photos[1].pairs).toHaveLength(1);
    expect(report.photos[2]).toMatchObject({ filledRoleCount: 2, passes: true });
    expect(report.photos[2].pairs).toHaveLength(1);
    expect(report.photos[2].pairs[0].deltaE).toBeGreaterThanOrEqual(12);
    expect(report.photos[2].pairs[0].deltaE2000).toBeLessThan(12);
  } finally {
    process.argv = originalArgv;
    log.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  }
});

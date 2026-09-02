import { describe, expect, it } from "vitest";
import { validateRelativePath } from "@/lib/auth/redirect";

describe("validateRelativePath", () => {
  const cases: Array<[string | null | undefined, string]> = [
    ["/items/abc", "/items/abc"],
    ["/capture?url=https%3A%2F%2Fexample.com", "/capture?url=https%3A%2F%2Fexample.com"],
    ["/", "/"],
    [null, "/"],
    [undefined, "/"],
    ["", "/"],
    ["https://evil.com", "/"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["/redirect?to=https://evil.com", "/"],
    ["/line\nbreak", "/"],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
      expect(validateRelativePath(input)).toBe(expected);
    });
  }
});

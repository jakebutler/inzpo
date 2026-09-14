import { describe, expect, it } from "vitest";
import { isPrivateIp, pinAddress } from "@/lib/ssrf";

describe("isPrivateIp", () => {
  const privateCases = [
    "10.0.0.1",
    "10.255.255.255",
    "127.0.0.1",
    "0.0.0.0",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "100.64.0.1",
    "100.127.255.255",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:10.0.0.1",
    "not-an-ip",
    "1.2.3",
  ];

  const publicCases = [
    "8.8.8.8",
    "1.2.3.4",
    "172.32.0.1",
    "172.15.255.255",
    "100.63.255.255",
    "100.128.0.1",
    "2606:4700::1111",
    "::ffff:8.8.8.8",
  ];

  for (const ip of privateCases) {
    it(`treats ${ip} as private`, () => {
      expect(isPrivateIp(ip)).toBe(true);
    });
  }

  for (const ip of publicCases) {
    it(`treats ${ip} as public`, () => {
      expect(isPrivateIp(ip)).toBe(false);
    });
  }
});

describe("pinAddress (rebinding TOCTOU selection)", () => {
  it("pins the first resolved address when every address is public", () => {
    expect(pinAddress("example.com", [{ address: "1.2.3.4" }, { address: "5.6.7.8" }])).toBe("1.2.3.4");
  });

  it("rejects empty resolution", () => {
    expect(() => pinAddress("example.com", [])).toThrow(/does not resolve/);
  });

  it("rejects when any resolved address is private, even if the first is public", () => {
    expect(() => pinAddress("rebind.attacker.tld", [{ address: "1.2.3.4" }, { address: "169.254.169.254" }])).toThrow(
      /Blocked private address/,
    );
  });

  it("rejects a private first address", () => {
    expect(() => pinAddress("rebind.attacker.tld", [{ address: "10.1.2.3" }])).toThrow(/Blocked private address/);
  });
});

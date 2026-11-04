import { describe, it, expect } from "vitest";
import { validatePasswordComplexity, DEFAULT_POLICY } from "@/lib/password-policy";

describe("validatePasswordComplexity", () => {
  it("accepts a password meeting every default rule", () => {
    expect(validatePasswordComplexity("Correct#Horse9Battery")).toEqual([]);
  });

  it("rejects a password that is too short", () => {
    const errors = validatePasswordComplexity("Sh0rt#1");
    expect(errors.some((e) => e.includes("at least"))).toBe(true);
  });

  it("requires an uppercase letter", () => {
    const errors = validatePasswordComplexity("lowercase#only9pass");
    expect(errors.some((e) => e.includes("uppercase"))).toBe(true);
  });

  it("requires a lowercase letter", () => {
    const errors = validatePasswordComplexity("UPPERCASE#ONLY9PASS");
    expect(errors.some((e) => e.includes("lowercase"))).toBe(true);
  });

  it("requires a number", () => {
    const errors = validatePasswordComplexity("NoNumbersHere#Pass");
    expect(errors.some((e) => e.includes("number"))).toBe(true);
  });

  it("requires a symbol", () => {
    const errors = validatePasswordComplexity("NoSymbolsHere9Pass");
    expect(errors.some((e) => e.includes("symbol"))).toBe(true);
  });

  it("reports every violated rule at once, not just the first", () => {
    const errors = validatePasswordComplexity("short");
    expect(errors.length).toBeGreaterThan(1);
  });

  it("respects a relaxed custom policy (used for recipient signing passwords)", () => {
    const relaxed = {
      passwordMinLength: 8,
      passwordRequireUpper: false,
      passwordRequireLower: false,
      passwordRequireNumber: true,
      passwordRequireSymbol: false,
    };
    expect(validatePasswordComplexity("alllower1", relaxed)).toEqual([]);
    expect(validatePasswordComplexity("alllower", relaxed).length).toBeGreaterThan(0);
  });

  it("DEFAULT_POLICY matches the documented org defaults", () => {
    expect(DEFAULT_POLICY.passwordMinLength).toBe(12);
    expect(DEFAULT_POLICY.maxFailedLoginAttempts).toBe(5);
  });
});

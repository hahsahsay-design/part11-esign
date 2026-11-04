import { describe, it, expect } from "vitest";
import { computeSignatureBinding, verifySignatureBinding, type SignatureBindingInput } from "@/lib/esignature";

const base: SignatureBindingInput = {
  documentVersionHash: "a".repeat(64),
  fieldId: "field-1",
  recipientId: "recipient-1",
  meaningCode: "SIGNED",
  printedName: "Dana Whitfield",
  signerUserId: "user-1",
  signedAtIso: "2026-11-03T20:11:03.027Z",
};

describe("21 CFR 11.70 signature/record binding", () => {
  it("verifies against its own exact inputs", () => {
    const binding = computeSignatureBinding(base);
    expect(verifySignatureBinding(base, binding)).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    expect(computeSignatureBinding(base)).toBe(computeSignatureBinding(base));
  });

  it("fails if the binding is replayed against a different document version (copy-to-another-record attack)", () => {
    const binding = computeSignatureBinding(base);
    const otherDocument = { ...base, documentVersionHash: "b".repeat(64) };
    expect(verifySignatureBinding(otherDocument, binding)).toBe(false);
  });

  it("fails if the signer identity is swapped", () => {
    const binding = computeSignatureBinding(base);
    const otherSigner = { ...base, signerUserId: "user-2", printedName: "Someone Else" };
    expect(verifySignatureBinding(otherSigner, binding)).toBe(false);
  });

  it("fails if the meaning is changed (e.g. Reviewed by -> Approved by after the fact)", () => {
    const binding = computeSignatureBinding(base);
    const otherMeaning = { ...base, meaningCode: "APPROVED" };
    expect(verifySignatureBinding(otherMeaning, binding)).toBe(false);
  });

  it("fails if the timestamp is altered", () => {
    const binding = computeSignatureBinding(base);
    const otherTime = { ...base, signedAtIso: "2026-11-03T20:11:03.028Z" };
    expect(verifySignatureBinding(otherTime, binding)).toBe(false);
  });

  it("treats an external signer (no platform account) consistently", () => {
    const external: SignatureBindingInput = { ...base, signerUserId: null };
    const binding = computeSignatureBinding(external);
    expect(verifySignatureBinding(external, binding)).toBe(true);
    expect(verifySignatureBinding(base, binding)).toBe(false);
  });
});

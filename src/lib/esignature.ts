import { createHmac } from "node:crypto";

function signingKey(): string {
  const key = process.env.DOCUMENT_SIGNING_KEY;
  if (!key) throw new Error("DOCUMENT_SIGNING_KEY is not configured");
  return key;
}

export interface SignatureBindingInput {
  documentVersionHash: string;
  fieldId: string;
  recipientId: string;
  meaningCode: string;
  printedName: string;
  signerUserId: string | null;
  signedAtIso: string;
}

/**
 * 21 CFR 11.70 binding: an HMAC over the exact document-version hash, field,
 * recipient, meaning, signer identity, and timestamp. Changing any of those
 * — including copying the signature onto a different record — invalidates
 * the signature, because the value being verified no longer matches what was
 * signed. Verification requires the server's DOCUMENT_SIGNING_KEY, so a
 * party with database access alone cannot forge a valid replacement.
 */
export function computeSignatureBinding(input: SignatureBindingInput): string {
  const canonical = [
    input.documentVersionHash,
    input.fieldId,
    input.recipientId,
    input.meaningCode,
    input.printedName,
    input.signerUserId ?? "external",
    input.signedAtIso,
  ].join("|");
  return createHmac("sha256", signingKey()).update(canonical).digest("hex");
}

export function verifySignatureBinding(input: SignatureBindingInput, binding: string): boolean {
  return computeSignatureBinding(input) === binding;
}

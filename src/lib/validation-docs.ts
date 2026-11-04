import fs from "node:fs/promises";
import path from "node:path";

// Whitelisted so a ?doc= query param can never be used to read an arbitrary file off disk.
export const VALIDATION_DOCS = [
  { file: "README.md", title: "Validation package index" },
  { file: "01-user-requirements-specification.md", title: "01 — User Requirements Specification" },
  { file: "02-functional-specification.md", title: "02 — Functional Specification" },
  { file: "03-technical-specification.md", title: "03 — Technical Specification" },
  { file: "04-risk-assessment.md", title: "04 — Risk Assessment" },
  { file: "05-installation-qualification.md", title: "05 — Installation Qualification (IQ)" },
  { file: "06-operational-qualification.md", title: "06 — Operational Qualification (OQ)" },
  { file: "07-performance-qualification.md", title: "07 — Performance Qualification (PQ)" },
  { file: "08-software-test-plan.md", title: "08 — Software Test Plan" },
  { file: "09-change-control-procedure.md", title: "09 — Change Control Procedure" },
  { file: "10-incident-management-procedure.md", title: "10 — Incident Management Procedure" },
  { file: "11-release-management-procedure.md", title: "11 — Release Management Procedure" },
] as const;

export type ValidationDocFile = (typeof VALIDATION_DOCS)[number]["file"];

export function isValidationDocFile(value: string): value is ValidationDocFile {
  return VALIDATION_DOCS.some((d) => d.file === value);
}

export async function readValidationDoc(file: ValidationDocFile): Promise<string> {
  const fullPath = path.join(process.cwd(), "docs", "validation", file);
  return fs.readFile(fullPath, "utf-8");
}

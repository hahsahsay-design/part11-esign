import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/reports";

describe("toCsv", () => {
  it("renders a header row and data rows in column order", () => {
    const csv = toCsv({
      columns: ["Name", "Role"],
      rows: [{ Name: "Dana Whitfield", Role: "ORG_OWNER" }],
    });
    expect(csv).toBe("Name,Role\nDana Whitfield,ORG_OWNER");
  });

  it("quotes and escapes a value containing a comma", () => {
    const csv = toCsv({ columns: ["Description"], rows: [{ Description: "signed, then approved" }] });
    expect(csv).toBe('Description\n"signed, then approved"');
  });

  it("quotes and escapes a value containing a double quote", () => {
    const csv = toCsv({ columns: ["Description"], rows: [{ Description: 'said "approved"' }] });
    expect(csv).toBe('Description\n"said ""approved"""');
  });

  it("quotes a value containing a newline", () => {
    const csv = toCsv({ columns: ["Description"], rows: [{ Description: "line one\nline two" }] });
    expect(csv).toBe('Description\n"line one\nline two"');
  });

  it("fills a missing field with an empty cell rather than throwing", () => {
    const csv = toCsv({ columns: ["A", "B"], rows: [{ A: "x" }] });
    expect(csv).toBe("A,B\nx,");
  });

  it("handles an empty result set (header only)", () => {
    expect(toCsv({ columns: ["A"], rows: [] })).toBe("A");
  });
});

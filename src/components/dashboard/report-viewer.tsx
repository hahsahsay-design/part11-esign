"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2 } from "lucide-react";

const REPORTS: { value: string; label: string }[] = [
  { value: "org-activity", label: "Organization Activity" },
  { value: "document-audit-trail", label: "Document Audit Trail" },
  { value: "signature-history", label: "Signature History" },
  { value: "user-access", label: "User Access" },
  { value: "failed-auth", label: "Failed Authentication Attempts" },
  { value: "document-integrity", label: "Document Integrity" },
  { value: "training", label: "User Training" },
  { value: "system-config", label: "System Configuration History" },
];

interface ReportResult {
  columns: string[];
  rows: Record<string, string>[];
}

export function ReportViewer({ canExport }: { canExport: boolean }) {
  const [type, setType] = useState("org-activity");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(selected: string) {
    setType(selected);
    setLoading(true);
    try {
      const res = await fetch(`/api/compliance/reports/${selected}`);
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const link = document.createElement("a");
    link.href = `/api/compliance/reports/${type}?format=csv`;
    link.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Select
          value={type}
          onValueChange={(v) => {
            if (v) run(v);
          }}
        >
          <SelectTrigger className="w-72">
            <SelectValue>{(v: string) => REPORTS.find((r) => r.value === v)?.label ?? "Choose a report"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {REPORTS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          {!result && (
            <Button variant="outline" onClick={() => run(type)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run report"}
            </Button>
          )}
          {canExport && result && (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Running report…</p>}

      {result && !loading && (
        <div className="max-h-[32rem] overflow-auto rounded-md border">
          {result.rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No data for this report yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {result.columns.map((c) => (
                    <TableHead key={c} className="whitespace-nowrap">
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => (
                  <TableRow key={i}>
                    {result.columns.map((c) => (
                      <TableCell key={c} className="whitespace-nowrap text-xs">
                        {row[c]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

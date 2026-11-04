"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert } from "lucide-react";

interface Result {
  documentTitle: string;
  versionNumber: number;
  storedHash: string;
  recomputedHash: string;
  match: boolean;
}

export function VerifyDocumentIntegrityButton() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/verify-document-integrity", { method: "POST" });
      const data = await res.json();
      setResults(data.results);
    } finally {
      setLoading(false);
    }
  }

  const failureCount = results?.filter((r) => !r.match).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={run} disabled={loading}>
          {loading ? "Verifying…" : "Verify document integrity"}
        </Button>
        {results && (
          <span className={`flex items-center gap-1 text-sm ${failureCount === 0 ? "text-success" : "text-destructive"}`}>
            {failureCount === 0 ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            {failureCount === 0 ? `All ${results.length} version(s) verified` : `${failureCount} mismatch(es) found`}
          </span>
        )}
      </div>
      {results && results.length > 0 && (
        <div className="max-h-80 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Stored hash</TableHead>
                <TableHead>Recomputed hash</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.documentTitle}</TableCell>
                  <TableCell>v{r.versionNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{r.storedHash.slice(0, 16)}…</TableCell>
                  <TableCell className="font-mono text-xs">{r.recomputedHash.slice(0, 16)}…</TableCell>
                  <TableCell>
                    <Badge variant={r.match ? "default" : "destructive"}>{r.match ? "Match" : "Mismatch"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

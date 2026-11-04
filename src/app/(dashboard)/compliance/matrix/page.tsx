import { requireAuthenticatedContext } from "@/lib/auth-guard";
import { COMPLIANCE_MATRIX } from "@/lib/compliance-matrix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  Implemented: "default",
  "Partially implemented": "secondary",
  "Customer-dependent": "outline",
};

export default async function ComplianceMatrixPage() {
  await requireAuthenticatedContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">21 CFR Part 11 Compliance Matrix</h1>
        <p className="text-sm text-muted-foreground">
          Traces every applicable provision to the technical control implemented for it, where it lives in the
          codebase, and what remains the customer&apos;s responsibility.
        </p>
      </div>

      <Alert>
        <AlertDescription>
          This matrix documents <strong>technical controls that exist and were manually or automatically verified
          in this development environment</strong> — it is not a validation record and not a certification of
          regulatory compliance. &quot;Implemented&quot; means the described control is built and working; it does
          not mean validated for a specific regulated use, and a test result below reflects this environment only,
          never yours. Formal validation (IQ/OQ/PQ against your own User Requirements Specification), SOPs, and
          personnel training remain your organization&apos;s responsibility — see{" "}
          <a href="/compliance/validation" className="underline">
            the validation documentation package
          </a>{" "}
          (Phase 8 in the project README).
        </AlertDescription>
      </Alert>

      {COMPLIANCE_MATRIX.map((group) => (
        <Card key={group.section}>
          <CardHeader>
            <CardTitle className="text-base">{group.section}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Citation</TableHead>
                  <TableHead className="w-56">Requirement</TableHead>
                  <TableHead className="w-64">Software functionality &amp; technical implementation</TableHead>
                  <TableHead className="w-64">Test cases &amp; results</TableHead>
                  <TableHead className="w-48">Supporting documentation</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.rows.map((row) => (
                  <TableRow key={row.citation}>
                    <TableCell className="font-mono text-xs font-medium align-top">{row.citation}</TableCell>
                    <TableCell className="text-sm align-top">{row.requirement}</TableCell>
                    <TableCell className="text-sm align-top">
                      {row.control}
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{row.location}</p>
                      {row.note && <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>}
                    </TableCell>
                    <TableCell className="text-sm align-top">
                      <p>{row.testCases}</p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">{row.testResult}</p>
                    </TableCell>
                    <TableCell className="text-xs align-top">
                      {row.supportingDoc === "—" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : row.supportingDoc.startsWith("docs/validation/") ? (
                        <a
                          href={`/compliance/validation?doc=${encodeURIComponent(row.supportingDoc.replace(/^docs\/validation\//, "").split("#")[0])}`}
                          className="font-mono text-primary underline"
                        >
                          {row.supportingDoc}
                        </a>
                      ) : (
                        <span className="font-mono text-muted-foreground">{row.supportingDoc}</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, FileText } from "lucide-react";
import { SigningPdfViewer } from "@/components/signing/signing-pdf-viewer";
import { SignConfirmDialog } from "@/components/signing/sign-confirm-dialog";
import { DeclineDialog } from "@/components/signing/decline-dialog";

export interface SigningField {
  id: string;
  type: "SIGNATURE" | "INITIALS" | "DATE" | "TEXT" | "CHECKBOX";
  page: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  required: boolean;
  label: string | null;
  defaultMeaning: { id: string; code: string; label: string } | null;
}

interface Bootstrap {
  recipient: { id: string; fullName: string; email: string; role: string; status: string; passwordSet: boolean; declineReason: string | null };
  isMyTurn: boolean;
  signatureRequest: { id: string; title: string; instructions: string | null; signingMode: string; status: string; expiresAt: string | null };
  document: { title: string; pageCount: number | null };
  organization: { name: string; primaryColor: string };
  fields: SigningField[];
}

export function SigningSession({ token }: { token: string }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [finalized, setFinalized] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/sign/${token}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "This signing link could not be loaded.");
        return;
      }
      setData(json);
      const today = new Date().toISOString().slice(0, 10);
      setResponses((r) => {
        const next = { ...r };
        for (const f of json.fields as SigningField[]) {
          if (f.type === "DATE" && !next[f.id]) next[f.id] = today;
        }
        return next;
      });
    } catch {
      setError("Something went wrong loading this document.");
    }
  }

  // Initial data fetch on mount — `load` is also called later to refresh
  // after password setup / signing / decline, so it's defined outside and
  // intentionally omitted from the dependency array (it's stable per render
  // only in identity, not memoized, and only `token` should re-trigger this).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (error) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Can&apos;t open this link</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return <p className="text-center text-sm text-muted-foreground">Loading…</p>;
  }

  const { recipient, signatureRequest, document, fields, isMyTurn } = data;

  if (recipient.status === "DECLINED") {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <XCircle className="mb-2 h-6 w-6 text-destructive" />
          <CardTitle>You declined to sign</CardTitle>
          <CardDescription>{recipient.declineReason}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (finalized || signatureRequest.status === "COMPLETED") {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CheckCircle2 className="mb-2 h-6 w-6 text-success" />
          <CardTitle>Signing complete</CardTitle>
          <CardDescription>All required signatures have been collected on &quot;{document.title}&quot;.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (recipient.status === "COMPLETED") {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CheckCircle2 className="mb-2 h-6 w-6 text-success" />
          <CardTitle>You already signed this document</CardTitle>
          <CardDescription>We&apos;ll email you when everyone else has completed their part.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (recipient.role === "CC") {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <Badge variant="secondary" className="w-fit">CC</Badge>
          <CardTitle>{document.title}</CardTitle>
          <CardDescription>You&apos;re copied on this document for awareness — no signature is required from you.</CardDescription>
        </CardHeader>
        <CardContent>
          <SigningPdfViewer token={token} fields={[]} responses={{}} onFieldChange={() => {}} />
        </CardContent>
      </Card>
    );
  }

  if (!isMyTurn) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <Clock className="mb-2 h-6 w-6 text-muted-foreground" />
          <CardTitle>Not your turn yet</CardTitle>
          <CardDescription>
            This document requires signatures in order. We&apos;ll email you as soon as it&apos;s your turn to sign.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!recipient.passwordSet) {
    return <SetSigningPassword token={token} onDone={load} />;
  }

  const requiredFields = fields.filter((f) => f.required && f.type !== "SIGNATURE" && f.type !== "INITIALS");
  const allFilled = requiredFields.every((f) => responses[f.id]?.trim());

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{signatureRequest.title}</CardTitle>
          <CardDescription>
            {document.title} — requested for {recipient.fullName} &lt;{recipient.email}&gt;
          </CardDescription>
          {signatureRequest.instructions && (
            <Alert className="mt-2">
              <AlertDescription>{signatureRequest.instructions}</AlertDescription>
            </Alert>
          )}
        </CardHeader>
      </Card>

      <div className="flex items-center justify-between rounded-md border bg-background p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          {fields.length} field{fields.length === 1 ? "" : "s"} to complete
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDeclineOpen(true)}>
            Decline to sign
          </Button>
          <Button disabled={!allFilled} onClick={() => setConfirmOpen(true)}>
            Review &amp; sign
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-auto bg-muted pt-6">
          <SigningPdfViewer
            token={token}
            fields={fields}
            responses={responses}
            onFieldChange={(id, value) => setResponses((r) => ({ ...r, [id]: value }))}
          />
        </CardContent>
      </Card>

      <SignConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        token={token}
        recipientName={recipient.fullName}
        fields={fields}
        responses={responses}
        onSigned={(didFinalize) => {
          setFinalized(didFinalize);
          load();
        }}
      />
      <DeclineDialog open={declineOpen} onOpenChange={setDeclineOpen} token={token} onDeclined={load} />
    </div>
  );
}

function SetSigningPassword({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${token}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not set a signing password.");
        return;
      }
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Create a signing password</CardTitle>
        <CardDescription>
          You&apos;ll be asked to re-enter this password to confirm your identity at the moment you sign. It&apos;s
          specific to this document, not a platform account password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">Signing password</Label>
            <Input id="password" type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">At least 8 characters, including a number.</p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving…" : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

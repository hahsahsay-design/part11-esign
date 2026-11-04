"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MfaEnrollPage() {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const enrollStarted = useRef(false);

  useEffect(() => {
    if (enrollStarted.current) return;
    enrollStarted.current = true;
    fetch("/api/auth/mfa/enroll", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        setQrDataUrl(data.qrDataUrl);
        setSecret(data.secret);
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
        return;
      }
      setBackupCodes(data.backupCodes);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (backupCodes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Save your backup codes</CardTitle>
          <CardDescription>
            Each code can be used once to sign in if you lose access to your authenticator app. Store them somewhere safe — they will not be shown again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted p-4 font-mono text-sm">
            {backupCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <Button className="w-full" onClick={() => router.push("/dashboard")}>
            I&apos;ve saved these codes — continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up multi-factor authentication</CardTitle>
        <CardDescription>
          Your organization requires MFA. Scan this QR code with an authenticator app (such as Google
          Authenticator or 1Password), then enter the 6-digit code it generates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="MFA QR code" className="mx-auto h-48 w-48 rounded-md border" />
        ) : (
          <div className="mx-auto h-48 w-48 animate-pulse rounded-md bg-muted" />
        )}
        {secret && (
          <p className="text-center text-xs text-muted-foreground">
            Can&apos;t scan? Enter this key manually: <span className="font-mono">{secret}</span>
          </p>
        )}
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              required
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying…" : "Verify and enable MFA"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

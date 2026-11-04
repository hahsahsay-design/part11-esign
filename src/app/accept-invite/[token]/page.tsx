"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";

interface Bootstrap {
  email: string;
  fullName: string;
  role: string;
  organizationName: string;
  userExists: boolean;
}

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "This invitation could not be loaded.");
          return;
        }
        setData(json);
      })
      .catch(() => setError("Something went wrong."));
  }, [token]);

  async function onAccept(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setIssues([]);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.requiresLogin) {
          setRequiresLogin(true);
          return;
        }
        setError(json.error ?? "Could not accept this invitation.");
        setIssues(json.issues ?? []);
        return;
      }
      router.push(json.mfaRequired ? "/mfa/enroll" : "/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <ShieldCheck className="mb-2 h-6 w-6 text-primary" />
          <CardTitle>You&apos;re invited</CardTitle>
          {data && (
            <CardDescription>
              Join <strong>{data.organizationName}</strong> as {data.role.replaceAll("_", " ").toLowerCase()} —{" "}
              {data.email}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
                {issues.length > 0 && (
                  <ul className="mt-1 list-inside list-disc">
                    {issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
          {requiresLogin && data && (
            <Alert>
              <AlertDescription>
                An account already exists for {data.email}.{" "}
                <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                  Log in
                </Link>{" "}
                with that account, then return to this link to join {data.organizationName}.
              </AlertDescription>
            </Alert>
          )}
          {data && !data.userExists && !requiresLogin && (
            <form className="space-y-4" onSubmit={onAccept}>
              <div className="space-y-2">
                <Label htmlFor="password">Create a password</Label>
                <Input id="password" type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  At least 12 characters, with upper/lowercase letters, a number, and a symbol.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Joining…" : "Accept and create account"}
              </Button>
            </form>
          )}
          {data && data.userExists && !requiresLogin && (
            <Button className="w-full" disabled={loading} onClick={() => onAccept()}>
              {loading ? "Joining…" : `Accept as ${data.email}`}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

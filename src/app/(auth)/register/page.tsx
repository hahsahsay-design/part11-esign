"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", organizationName: "" });
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIssues([]);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        setIssues(data.issues?.map((i: { message: string }) => i.message) ?? []);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to {form.email}. Verify your address to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your organization</CardTitle>
        <CardDescription>Start a 14-day trial. No credit card required.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
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
          <div className="space-y-2">
            <Label htmlFor="organizationName">Organization name</Label>
            <Input
              id="organizationName"
              required
              placeholder="Acme Biologics, Inc."
              value={form.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              required
              placeholder="Jane Doe"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="jane@acme.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              At least 12 characters, with upper/lowercase letters, a number, and a symbol.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

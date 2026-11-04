"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"pending" | "ok" | "error">(token ? "pending" : "error");
  const [message, setMessage] = useState(token ? "" : "Missing verification token.");

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        setStatus(res.ok ? "ok" : "error");
        setMessage(data.message ?? data.error ?? "");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong.");
      });
  }, [token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{status === "ok" ? "Email verified" : status === "error" ? "Verification failed" : "Verifying…"}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Go to sign in
        </Link>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}

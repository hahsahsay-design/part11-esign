import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OnboardingPage() {
  const current = await getCurrentSession();
  if (!current) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>No organization yet</CardTitle>
          <CardDescription>
            Your account ({current.user.email}) isn&apos;t a member of any organization. Ask an administrator to
            invite you, or create a new organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/register" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Create a new organization
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

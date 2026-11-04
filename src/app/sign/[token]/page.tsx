import { SigningSession } from "@/components/signing/signing-session";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SigningSession token={token} />;
}

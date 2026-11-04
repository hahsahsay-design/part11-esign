import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveSigningToken, SigningLinkError } from "@/lib/public-signing";
import { validatePasswordComplexity } from "@/lib/password-policy";

const schema = z.object({ password: z.string().min(8).max(200) });

// A recipient with no platform account sets this once, on first visiting
// their link — it becomes the second identification component they
// re-enter at the moment of signing (see schema doc-comment on
// signingPasswordHash). Internal platform users never hit this route: they
// reauthenticate with their normal account password instead.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { recipient } = await resolveSigningToken(token);
    if (recipient.signingPasswordHash) {
      return NextResponse.json({ error: "A signing password is already set for this link." }, { status: 409 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const errors = validatePasswordComplexity(parsed.data.password, {
      passwordMinLength: 8,
      passwordRequireUpper: false,
      passwordRequireLower: false,
      passwordRequireNumber: true,
      passwordRequireSymbol: false,
    });
    if (errors.length > 0) return NextResponse.json({ error: "Weak password", issues: errors }, { status: 400 });

    const signingPasswordHash = await bcrypt.hash(parsed.data.password, 12);
    await prisma.signatureRequestRecipient.update({ where: { id: recipient.id }, data: { signingPasswordHash } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SigningLinkError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

import { NextResponse } from "next/server";
import { resolveSigningToken, SigningLinkError } from "@/lib/public-signing";
import { getObject } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { recipient } = await resolveSigningToken(token);
    const bytes = await getObject(recipient.signatureRequest.sourceVersion.storageKey);
    return new NextResponse(new Blob([Uint8Array.from(bytes)]), {
      headers: { "Content-Type": recipient.signatureRequest.sourceVersion.mimeType, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof SigningLinkError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  try {
    const { membership } = await requireApiContext("documents.view_all");
    const folders = await prisma.documentFolder.findMany({
      where: { organizationId: membership.organizationId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ folders });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { membership } = await requireApiContext("documents.upload");
    const parsed = createFolderSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const folder = await prisma.documentFolder.create({
      data: {
        organizationId: membership.organizationId,
        name: parsed.data.name,
        parentId: parsed.data.parentId ?? null,
      },
    });
    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

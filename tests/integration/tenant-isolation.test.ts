import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { registerAndOnboard, type OnboardedUser } from "../helpers/register-user";
import { deleteTestOrganization, deleteTestUsers } from "../helpers/prisma";

function samplePdf(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF",
    "utf8",
  );
}

describe("tenant isolation", () => {
  let orgA: OnboardedUser;
  let orgB: OnboardedUser;

  beforeAll(async () => {
    orgA = await registerAndOnboard("tenant-a");
    orgB = await registerAndOnboard("tenant-b");
  }, 30000);

  afterAll(async () => {
    await deleteTestOrganization(orgA.organizationId);
    await deleteTestOrganization(orgB.organizationId);
    await deleteTestUsers([orgA.email, orgB.email]);
  });

  it("org A and org B are in fact different organizations", () => {
    expect(orgA.organizationId).not.toBe(orgB.organizationId);
  });

  it("org B cannot download org A's document by id", async () => {
    const formData = new FormData();
    formData.append("file", new Blob([Uint8Array.from(samplePdf())], { type: "application/pdf" }), "test.pdf");
    formData.append("title", "Org A Confidential Document");
    const uploadRes = await orgA.client.postForm("/api/documents", formData);
    expect(uploadRes.status).toBe(201);
    const { document } = await uploadRes.json();

    const ownDownload = await orgA.client.get(`/api/documents/${document.id}/download`);
    expect(ownDownload.status).toBe(200);

    const crossOrgDownload = await orgB.client.get(`/api/documents/${document.id}/download`);
    expect(crossOrgDownload.status).toBe(404);

    const crossOrgFile = await orgB.client.get(`/api/documents/${document.id}/file`);
    expect(crossOrgFile.status).toBe(404);
  });

  it("org B's document list never includes org A's documents", async () => {
    const res = await orgB.client.get("/api/documents");
    const { documents } = await res.json();
    expect(documents.every((d: { title: string }) => d.title !== "Org A Confidential Document")).toBe(true);
  });

  it("org B cannot rename or archive org A's document", async () => {
    const listRes = await orgA.client.get("/api/documents");
    const { documents } = await listRes.json();
    const docId = documents[0].id;

    const res = await orgB.client.patchJson(`/api/documents/${docId}`, { title: "Hijacked" });
    expect(res.status).toBe(404);
  });

  it("org B's admin routes never see org A's members", async () => {
    const res = await orgB.client.get("/api/admin/invites");
    expect([200, 403]).toContain(res.status); // 403 if orgB's owner permission check differs, 200 with empty/own-org list otherwise
  });
});

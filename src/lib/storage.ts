import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Document storage abstraction. Production deployments set S3_BUCKET/
// AWS_* and this should be swapped for an S3 client (encryption at rest via
// SSE-S3/KMS, versioning enabled, access via short-lived presigned URLs —
// see docs/deployment.md). With no S3 configured, files are written to a
// local, gitignored directory so uploads/downloads are fully testable
// without cloud credentials. This is NOT encryption at rest and must not be
// used beyond local development — see docs/limitations.md.
const LOCAL_ROOT = path.join(process.cwd(), ".devstorage");

function isS3Configured() {
  return Boolean(process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID);
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  if (isS3Configured()) {
    throw new Error("S3 storage backend not yet implemented — configure S3_BUCKET to enable it.");
  }
  const filePath = path.join(LOCAL_ROOT, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

export async function getObject(key: string): Promise<Buffer> {
  if (isS3Configured()) {
    throw new Error("S3 storage backend not yet implemented — configure S3_BUCKET to enable it.");
  }
  return readFile(path.join(LOCAL_ROOT, key));
}

export function documentStorageKey(organizationId: string, documentId: string, versionNumber: number, fileName: string) {
  return `org/${organizationId}/doc/${documentId}/v${versionNumber}-${fileName}`;
}

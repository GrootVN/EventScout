import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const archiveDir = process.env.RAW_ARCHIVE_DIR;

export async function archiveRawPayload(
  source: string,
  sourceEventId: string,
  payload: unknown,
  metadata?: Record<string, unknown>
) {
  if (!archiveDir) {
    return;
  }
  await mkdir(archiveDir, { recursive: true });
  const filename = `${source}-${sourceEventId}-${Date.now()}.json`;
  const target = path.join(archiveDir, filename);
  await writeFile(
    target,
    JSON.stringify(
      {
        payload,
        metadata: metadata ?? {},
        archived_at: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );
}

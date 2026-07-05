import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { env } from "../config/env";
import type { SaveResult, StorageProvider } from "./StorageProvider";

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/**
 * Stores uploaded images on the local filesystem under LOCAL_UPLOAD_DIR.
 * Files are served statically by Express at /uploads/<key>.
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly dir: string;

  constructor(uploadDir = env.localUploadDir) {
    // Resolve relative to process cwd so it works in dev and built output.
    this.dir = path.resolve(process.cwd(), uploadDir);
  }

  async save(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<SaveResult> {
    const ext = MIME_EXTENSION[mimeType] ?? path.extname(originalName) ?? "";
    const key = `${randomUUID()}${ext}`;

    try {
      await fs.mkdir(this.dir, { recursive: true });
      await fs.writeFile(path.join(this.dir, key), buffer);
    } catch (err) {
      throw new Error(
        `Failed to store file locally: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      key,
      url: `${env.publicBaseUrl.replace(/\/$/, "")}/uploads/${key}`,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.dir, key));
    } catch (err: unknown) {
      // Missing file is fine (idempotent). Re-throw anything else.
      if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
        throw err;
      }
    }
  }
}

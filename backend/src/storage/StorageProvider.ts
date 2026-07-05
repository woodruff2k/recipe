/**
 * Storage abstraction so the rest of the app never talks to the filesystem
 * (or S3) directly. Swapping LocalStorageProvider for an S3 implementation
 * requires no changes outside src/storage.
 */
export interface SaveResult {
  /** Opaque key used to later delete the object (e.g. filename or S3 key). */
  key: string;
  /** Public URL the frontend can render. */
  url: string;
}

export interface StorageProvider {
  /**
   * Persist a file buffer and return its key + public URL.
   * @param buffer raw file contents
   * @param originalName original client filename (used to derive an extension)
   * @param mimeType validated MIME type
   */
  save(buffer: Buffer, originalName: string, mimeType: string): Promise<SaveResult>;

  /** Remove a previously stored object. Should be idempotent. */
  delete(key: string): Promise<void>;
}

import { env } from "../config/env";
import { LocalStorageProvider } from "./LocalStorageProvider";
import type { StorageProvider } from "./StorageProvider";

/**
 * Factory that picks the storage backend from STORAGE_DRIVER.
 *
 * To enable S3 later:
 *   1. Add an S3StorageProvider implementing StorageProvider (use @aws-sdk/client-s3).
 *   2. Return it from the 's3' branch below.
 * No other part of the app needs to change.
 */
function createStorage(): StorageProvider {
  switch (env.storageDriver) {
    case "s3":
      throw new Error(
        "STORAGE_DRIVER=s3 is not implemented yet. Add S3StorageProvider in src/storage.",
      );
    case "local":
    default:
      return new LocalStorageProvider();
  }
}

export const storage: StorageProvider = createStorage();
export type { StorageProvider, SaveResult } from "./StorageProvider";

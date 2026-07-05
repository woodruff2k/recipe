import multer from "multer";
import { env } from "../config/env";
import { badRequest } from "../utils/errors";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * In-memory multer instance. We keep the buffer in memory and hand it to the
 * StorageProvider, so the same upload path works for local disk and S3.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(badRequest(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

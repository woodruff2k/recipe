import dotenv from "dotenv";

dotenv.config();

/**
 * Centralized, validated environment access.
 * Fails fast at boot if a required variable is missing so we never run
 * with a half-configured server.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number.parseInt(optional("PORT", "4000"), 10),
  corsOrigin: optional("CORS_ORIGIN", "http://localhost:3000"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "7d"),

  storageDriver: optional("STORAGE_DRIVER", "local") as "local" | "s3",
  publicBaseUrl: optional("PUBLIC_BASE_URL", "http://localhost:4000"),
  localUploadDir: optional("LOCAL_UPLOAD_DIR", "uploads"),
  maxUploadBytes: Number.parseInt(optional("MAX_UPLOAD_BYTES", "5242880"), 10),

  s3: {
    bucket: process.env.S3_BUCKET ?? "",
    region: process.env.S3_REGION ?? "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
} as const;

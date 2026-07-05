import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import yaml from "js-yaml";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import authRoutes from "./routes/auth";
import recipeRoutes from "./routes/recipes";
import uploadRoutes from "./routes/uploads";
import { errorHandler, notFoundHandler } from "./middlewares/error";

// __dirname 기준 상대 경로라 dev(ts-node-dev, src/)와 prod(dist/) 둘 다
// backend/openapi.yaml을 정확히 가리킨다(cwd에 의존하지 않음).
const openapiDocument = yaml.load(
  fs.readFileSync(path.join(__dirname, "../openapi.yaml"), "utf-8"),
) as swaggerUi.JsonObject;

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Serve locally stored uploads. In production with S3 this is unnecessary.
  if (env.storageDriver === "local") {
    app.use("/uploads", express.static(path.resolve(process.cwd(), env.localUploadDir)));
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Swagger UI: http://localhost:4000/api-docs (스펙 원본: backend/openapi.yaml)
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));
  app.get("/openapi.yaml", (_req, res) => {
    res.type("text/yaml").sendFile(path.join(__dirname, "../openapi.yaml"));
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/recipes", recipeRoutes);
  app.use("/api/uploads", uploadRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

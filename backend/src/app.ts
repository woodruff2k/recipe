import express from "express";
import cors from "cors";
import path from "path";
import { env } from "./config/env";
import authRoutes from "./routes/auth";
import recipeRoutes from "./routes/recipes";
import uploadRoutes from "./routes/uploads";
import { errorHandler, notFoundHandler } from "./middlewares/error";

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

  app.use("/api/auth", authRoutes);
  app.use("/api/recipes", recipeRoutes);
  app.use("/api/uploads", uploadRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

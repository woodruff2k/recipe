import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

async function main() {
  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(
      `🍳 Recipe API listening on http://localhost:${env.port} (${env.nodeEnv})`,
    );
  });

  // Graceful shutdown so Prisma/Postgres connections close cleanly.
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch(async (err) => {
  console.error("Fatal startup error:", err);
  await prisma.$disconnect();
  process.exit(1);
});

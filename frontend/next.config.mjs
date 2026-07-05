import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a minimal standalone server bundle for the Docker runtime stage.
  output: "standalone",
  // pnpm workspace: trace files from the monorepo root so hoisted deps in the
  // virtual store are included in the standalone bundle.
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  images: {
    // Allow images served by the local Express backend during development.
    // When migrating to S3, add the bucket/CDN host here.
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;

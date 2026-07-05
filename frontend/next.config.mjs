import path from "path";
import createBundleAnalyzer from "@next/bundle-analyzer";

// ANALYZE=true pnpm --filter ./frontend build 로 실행하면 .next/analyze/*.html에
// 클라이언트/서버 번들 트리맵이 생성된다. 평소 빌드에는 영향 없음(no-op).
const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a minimal standalone server bundle for the Docker runtime stage.
  output: "standalone",
  experimental: {
    // 배럴 파일(index가 전체를 re-export하는 패키지) import 시 실제 쓰는
    // 하위 모듈만 골라 담도록 강제 — sonner는 기본 최적화 목록에 없어 명시.
    // (lucide-react는 Next 14 기본 목록에 이미 포함되어 있어 중복 불필요.)
    optimizePackageImports: ["sonner"],
  },
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

export default withBundleAnalyzer(nextConfig);

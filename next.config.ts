import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/recordings/process": ["./node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;

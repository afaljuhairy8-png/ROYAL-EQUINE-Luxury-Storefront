import type { NextConfig } from "next";

const configuredBasePath = process.env.BASE_PATH?.trim();
const basePath =
  configuredBasePath && configuredBasePath !== "/"
    ? configuredBasePath.replace(/\/+$/, "")
    : "";

const nextConfig: NextConfig = {
  basePath,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: [
    "@workspace/api-zod",
    "@workspace/royal-equine-catalogue",
    "@workspace/royal-equine-server",
  ],
  serverExternalPackages: ["mongoose", "jsonwebtoken", "bcryptjs"],
};

export default nextConfig;

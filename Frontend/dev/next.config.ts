import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export so Capacitor can wrap the app into an Android APK.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;

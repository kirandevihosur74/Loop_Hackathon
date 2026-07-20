import type { NextConfig } from "next";

// Static sites served under a subpath (GitHub Pages project site, or a
// self-hosted /app path) need a basePath. Priority: explicit BASE_PATH env,
// then GitHub Pages default, else root (Capacitor/local).
const basePath =
  process.env.BASE_PATH ?? (process.env.GITHUB_PAGES === "true" ? "/Loop_Hackathon" : "");

const nextConfig: NextConfig = {
  // Static export so Capacitor can wrap the app into an Android APK.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
};

export default nextConfig;

import type { NextConfig } from "next";

// GitHub Pages serves a project site under /<repo>/, so the PWA build needs a
// basePath. Capacitor/local builds stay at root (GITHUB_PAGES unset).
const isPages = process.env.GITHUB_PAGES === "true";
const repo = "/Loop_Hackathon";

const nextConfig: NextConfig = {
  // Static export so Capacitor can wrap the app into an Android APK.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isPages ? repo : "",
};

export default nextConfig;

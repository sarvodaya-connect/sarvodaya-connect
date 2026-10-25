import type { NextConfig } from "next";

// Static export so the landing page can be served from any static host.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;

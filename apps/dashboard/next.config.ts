import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not tell visitors which framework serves the dashboard.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Browsers remember to use HTTPS, so a first visit cannot be downgraded.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nobody may embed the dashboard in a frame. The CSP directive covers
          // modern browsers; X-Frame-Options covers older ones.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

import { SAVE_GARD_WS_BASE_URL } from "./src/config/saveGard";

const contentSecurityPolicy = [
  "connect-src",
  "'self'",
  SAVE_GARD_WS_BASE_URL
].join(" ");

const nextConfig: NextConfig = {
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `${contentSecurityPolicy};`
          }
        ]
      }
    ];
  }
};

export default nextConfig;

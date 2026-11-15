import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nobody may frame Dor: stops clickjacking on Approve / Stop buttons.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

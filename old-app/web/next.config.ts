import type { NextConfig } from "next";

const apiOrigin =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/pdf-proxy/:slug/:filename",
        destination: `${apiOrigin}/api/candidates/:slug/attachment/:filename`,
      },
    ];
  },
};

export default nextConfig;

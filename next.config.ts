import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  async redirects() {
    return [
      // /tickets is referenced in legacy emails and external posts.
      // Permanently redirect to the actual portal page.
      {
        source: "/tickets",
        destination: "/portal/tickets",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

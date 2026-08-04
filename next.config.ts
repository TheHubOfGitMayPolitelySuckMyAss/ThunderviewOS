import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /admin/atlas reads docs/** from disk at request time; without this the
  // markdown is missing from the deployed function bundle.
  outputFileTracingIncludes: {
    "/admin/atlas": ["./docs/atlas/**/*.md", "./docs/docket.md"],
  },
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

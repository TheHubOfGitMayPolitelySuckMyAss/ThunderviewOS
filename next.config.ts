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
      // The pre-cutover host still resolves to production, and it is NOT in
      // Supabase's redirect allow-list. A magic link requested from there gets
      // its redirect_to silently replaced with Site URL, so /auth/confirm never
      // runs and the user loops back to the login form. Session cookies are
      // host-scoped too, so this host is logged out even for signed-in members.
      // Exact host only — preview deploys (thunderview-os-git-*) must not match.
      {
        source: "/:path*",
        has: [{ type: "host", value: "thunderview-os.vercel.app" }],
        destination: "https://thunderviewceodinners.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

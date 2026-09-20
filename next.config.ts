import type { NextConfig } from "next";

/**
 * Security headers (see CLAUDE.md, "Sécurité").
 * The Content-Security-Policy with nonces is added in Phase 11 once every external
 * origin (Supabase, Vercel, Resend) is known; the other headers apply from day one.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
};

export default nextConfig;

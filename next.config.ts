import type { NextConfig } from "next";

/**
 * Security headers (see CLAUDE.md, "Sécurité").
 *
 * The Content-Security-Policy is **not** here: it carries a per-request nonce,
 * so it is built in the middleware where a request exists. Everything below is
 * the same for every response, and belongs in the static configuration.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Isole l'onglet des autres origines : sans cela, une page tierce ouverte par
  // l'application pourrait mesurer ce qui s'y passe.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
};

export default nextConfig;

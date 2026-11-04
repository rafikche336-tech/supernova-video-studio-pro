/**
 * Next.js configuration.
 *
 * Security posture (see SECURITY.md):
 *  - no framework disclosure (`poweredByHeader: false`)
 *  - a strict Content-Security-Policy with an explicit media allow-list
 *  - standard hardening headers on every response
 *  - long-lived, immutable caching for self-hosted demo media
 */
import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * `'unsafe-inline'` for scripts is required because the app is statically
 * rendered and Next.js inlines its hydration payload. If you need a nonce
 * instead, see docs/ARCHITECTURE.md ("CSP nonces") — it makes the page dynamic.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        // Demo clips are fixed assets; cache them aggressively.
        source: '/media/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/api/render',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },

  async redirects() {
    return [
      // v1 shipped a versioned path; keep old clients working.
      { source: '/api/v14/render', destination: '/api/render', permanent: true },
    ];
  },
};

export default nextConfig;

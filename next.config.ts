import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep existing local Vite-prefixed variables working during the transition.
  // Vercel should use the NEXT_PUBLIC_* names documented in .env.example.
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_ANON_KEY,
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ];
    const privateHeaders = [
      { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
      { key: "Pragma", value: "no-cache" },
    ];

    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/", headers: privateHeaders },
      { source: "/auth/:path*", headers: privateHeaders },
      { source: "/api/:path*", headers: privateHeaders },
    ];
  },
};

export default nextConfig;

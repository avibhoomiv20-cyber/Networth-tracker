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
  },
};

export default nextConfig;

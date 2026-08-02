# AssetTracker Web

The web companion for AssetTracker. It uses Next.js for deployment and
Supabase for authentication and shared tracker data.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
```

Set these values in `.env.local` for local development and in Vercel for
production:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` remains supported for existing deployments.
Add `http://localhost:3000/auth/callback`, the production callback URL, and the
matching Vercel Preview callback pattern to Supabase Authentication redirect
URLs. Authenticated portfolio pages are server-rendered with cookie-based
Supabase sessions and private/no-store response headers.

The deterministic Insights screen works without an AI provider. Conversational
analysis is served by the authenticated Supabase Edge Function in
`../supabase/functions/networth-ai-chat`. Configure it once in Supabase:

```bash
supabase secrets set GEMINI_API_KEY=your-server-side-key GEMINI_MODEL=gemini-3.5-flash-lite
supabase functions deploy networth-ai-chat
```

The function validates the caller's Supabase session and queries through the
caller's RLS permissions. The Gemini key is never shipped to the browser or Mac
app. Before calling Gemini, the function removes workspace names, account names,
descriptions, and comments; only anonymized financial aggregates are sent.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: create the standard Next.js `.next` deployment output

## Vercel release

1. Keep Preview and Production Supabase variables separate in Vercel.
2. Build with `npm run build`; use the standard Next.js output.
3. Verify `/auth/callback`, sign-in refresh, mobile navigation, and all four themes in Preview.
4. Promote the verified deployment. Roll back by selecting the last healthy Vercel deployment; no database rollback is required for this web-only refactor.

# NetWorth Tracker Web

The web companion for NetWorth Tracker. It uses Next.js for deployment and
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
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

The deterministic Insights screen works without an AI provider. Conversational
analysis is served by the authenticated Supabase Edge Function in
`../supabase/functions/networth-ai-chat`. Configure it once in Supabase:

```bash
supabase secrets set GEMINI_API_KEY=your-server-side-key GEMINI_MODEL=gemini-2.5-flash-lite
supabase functions deploy networth-ai-chat
```

The function validates the caller's Supabase session and queries through the
caller's RLS permissions. The Gemini key is never shipped to the browser or Mac
app. Before calling Gemini, the function removes workspace names, account names,
descriptions, and comments; only anonymized financial aggregates are sent.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: create the standard Next.js `.next` deployment output

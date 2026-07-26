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

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: create the standard Next.js `.next` deployment output

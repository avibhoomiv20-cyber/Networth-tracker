import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/pwa/PwaRegistration";
import "./globals.css";

const siteURL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteURL),
  title: {
    default: "AssetTracker",
    template: "%s · AssetTracker",
  },
  description:
    "A private personal portfolio for tracking assets, liabilities and net worth.",
  applicationName: "AssetTracker",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AssetTracker",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: { index: false, follow: false },
  openGraph: {
    title: "AssetTracker",
    description:
      "See your complete portfolio in one calm, private place.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "AssetTracker dashboard with portfolio insights and a private AI assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AssetTracker",
    description:
      "See your complete portfolio in one calm, private place.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#f5f1e8",
  viewportFit: "cover",
};

const themeBootstrap = `
try {
  const saved = localStorage.getItem("networth-theme");
  if (saved) document.documentElement.dataset.theme = saved;
} catch {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body><PwaRegistration />{children}</body>
    </html>
  );
}

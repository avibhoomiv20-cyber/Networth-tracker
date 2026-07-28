import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteURL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteURL),
  title: {
    default: "NetWorth Tracker",
    template: "%s · NetWorth Tracker",
  },
  description:
    "A private, shared workspace for tracking accounts, holdings and net worth.",
  applicationName: "NetWorth Tracker",
  openGraph: {
    title: "NetWorth Tracker",
    description:
      "See your complete financial picture in one calm, private workspace.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "NetWorth Tracker dashboard with financial insights and an AI assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NetWorth Tracker",
    description:
      "See your complete financial picture in one calm, private workspace.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f4f7f5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

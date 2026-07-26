import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
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
        url: "/networth-social.png",
        width: 1200,
        height: 630,
        alt: "A calm light-theme financial dashboard and net-worth trend",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NetWorth Tracker",
    description:
      "See your complete financial picture in one calm, private workspace.",
    images: ["/networth-social.png"],
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

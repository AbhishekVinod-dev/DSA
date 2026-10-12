import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import StructuredData from "../components/StructuredData";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
});

const BASE_URL = "https://smarttraffic-analytics.vercel.app";

const TITLE = "SmartTraffic Analytics | Explainable Traffic Violation Analytics";
const DESCRIPTION =
  "Smart Traffic Violation Prevention & Management System: an academic JavaFX and MySQL project that scores repeat driving behaviour, detects repeated patterns, ranks hotspots and raises evidence-backed review alerts. Decision support only.";

export const viewport: Viewport = {
  themeColor: "#0E4225",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: TITLE,
    template: "%s | SmartTraffic Analytics",
  },
  description: DESCRIPTION,
  keywords: [
    "SmartTraffic Analytics",
    "traffic violation analytics",
    "traffic violation prevention",
    "driver risk score",
    "repeated violation detection",
    "traffic hotspot analysis",
    "time of day traffic analysis",
    "violation trend tracking",
    "smart traffic alerts",
    "traffic violation report",
    "JavaFX project",
    "MySQL JDBC project",
    "decision support system",
    "traffic enforcement analytics"
  ],
  authors: [{ name: "SmartTraffic Analytics Project", url: BASE_URL }],
  creator: "SmartTraffic Analytics",
  publisher: "SmartTraffic Analytics",
  applicationName: "SmartTraffic Analytics",
  category: "Traffic enforcement analytics",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: BASE_URL,
    siteName: "SmartTraffic Analytics",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SmartTraffic Analytics — explainable traffic violation analytics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "390c0932538a0201",
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || "yandex-verification-placeholder",
    other: {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_VERIFICATION || "bing-verification-placeholder",
    },
  },
  appleWebApp: {
    capable: true,
    title: "SmartTraffic Analytics",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className={`${spaceGrotesk.className} min-h-screen bg-[#FBF5DD] text-[#0E4225] antialiased selection:bg-emerald-600 selection:text-white`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-br-lg focus:bg-[#0E4225] focus:p-4 focus:font-bold focus:text-[#FBF5DD] focus:shadow-lg"
        >
          Skip to main content
        </a>
        <StructuredData />
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}

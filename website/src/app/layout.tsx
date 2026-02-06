import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s - Tracely",
    default: "Tracely — Real-time observability for Python",
  },
  description:
    "Monitor your Python apps in real-time. Zero-config auto-instrumentation for FastAPI, Django, and Flask with smart data redaction and live request streaming.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    title: "Tracely",
  },
  openGraph: {
    title: "Tracely — Real-time observability for Python",
    description:
      "Monitor your Python apps in real-time. Zero-config auto-instrumentation for FastAPI, Django, and Flask with smart data redaction and live request streaming.",
    url: "https://tracely.sh",
    siteName: "Tracely",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  metadataBase: new URL("https://tracely.sh"),
  alternates: {
    canonical: "https://tracely.sh",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}

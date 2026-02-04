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
  title: "Tracely — Real-time observability for Python",
  description:
    "Monitor your Python apps in real-time. Zero-config auto-instrumentation for FastAPI, Django, and Flask with smart data redaction and live request streaming.",
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
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}

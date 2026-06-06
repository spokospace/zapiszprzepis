import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PWARegister } from "./components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZapiszPrzepis",
  description: "Archiwum przepisów udostępnianych z mediów społecznościowych.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ZapiszPrzepis",
  },
  formatDetection: {
    telephone: false,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  icons: {
    apple: "/icons/icon-192x192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}

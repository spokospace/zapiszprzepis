import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWARegister } from "./components/pwa-register";

export const metadata: Metadata = {
  title: "Zapisz Przepis",
  description: "Archiwum przepisów udostępnianych z mediów społecznościowych.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zapisz Przepis",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192x192.png",
  },
};

// Next reads the viewport from this export, not from `metadata`. resizes-content: the
// on-screen keyboard shrinks the layout, so /szukaj's quick-search bar (E01-S26)
// stays visible above it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full flex flex-col mx-auto w-full max-w-screen-2xl">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}

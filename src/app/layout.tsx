import type { Metadata, Viewport } from "next";
import "./globals.css";
import { HOME_DESCRIPTION, HOME_TITLE } from "@/lib/home-meta";
import { PWARegister } from "./components/pwa-register";
import { SiteFooter } from "./components/site-footer";
import { TextScaleApplier } from "./components/text-scale-applier";
import { TimerProvider } from "./components/timer-provider";
import { TimerCards } from "./components/timer-cards";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
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
  // Emit a runtime <meta name="theme-color"> so Chromium browsers tint the system
  // bars from the live page, not only the manifest (read at install time). Matches
  // the manifest theme_color (#c2410c, bg-action); white reintroduces the invisible
  // Android nav-button bug fixed in #456. See #475.
  themeColor: "#c2410c",
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
      {/* Full width so section backgrounds (the home hero, the header border) reach the
          viewport edges; content stays centred at 1152 px via PageContainer (E01-S31 §4). */}
      <body className="min-h-full flex flex-col w-full">
        <TimerProvider>
          {children}
          <TimerCards />
        </TimerProvider>
        <SiteFooter />
        <PWARegister />
        {/* Applies the saved text-size level (zp-text-scale) app-wide by owning the
            `--text-scale` write; the control itself lives on /wyswietlanie. */}
        <TextScaleApplier />
      </body>
    </html>
  );
}

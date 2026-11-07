import type { Metadata, Viewport } from "next";
import "./globals.css";
import { preload } from "react-dom";
import { AUTH_COOKIE_SCRIPT } from "@/lib/auth-cookie";
import { GREETING_SCRIPT } from "@/lib/greeting-cache";
import { SPEECH_SCRIPT } from "@/lib/speech";
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

const FONT_SUBSETS = ["latin", "latin-ext"] as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Both subsets (Polish letters live in latin-ext) ask for the file with the HTML, so the
  // font is there for the first paint and text does not rewrap when it arrives (#744).
  for (const subset of FONT_SUBSETS) {
    preload(`/fonts/atkinson-hyperlegible-next-${subset}.woff2`, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }
  return (
    // suppressHydrationWarning: AUTH_COOKIE_SCRIPT marks <html> before React hydrates it.
    <html lang="pl" className="h-full antialiased" suppressHydrationWarning>
      {/* Full width so section backgrounds (the home hero, the header border) reach the
          viewport edges; content stays centred at 1152 px via PageContainer (E01-S31 §4). */}
      <body className="min-h-full flex flex-col w-full">
        <script dangerouslySetInnerHTML={{ __html: `${AUTH_COOKIE_SCRIPT};${GREETING_SCRIPT};${SPEECH_SCRIPT}` }} />
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

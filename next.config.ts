import type { NextConfig } from "next"
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"
// @ts-expect-error - next-pwa doesn't have TypeScript definitions
import withPWA from "next-pwa"
import { imageRemotePatterns } from "./src/lib/image-remote-patterns"

const baseConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: imageRemotePatterns(process.env.NEXT_PUBLIC_SUPABASE_URL),
  },
}

const nextConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  dynamicStartUrl: false,
  scope: "/",
  register: false,
  skipWaiting: false,
  workboxOptions: {
    disableDevLogs: true,
    clientsClaim: true,
    skipWaiting: false,
  },
})(baseConfig)

initOpenNextCloudflareForDev()

export default nextConfig

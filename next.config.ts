import type { NextConfig } from "next"
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"
// @ts-ignore - next-pwa doesn't have TypeScript definitions
import withPWA from "next-pwa"

const baseConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
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

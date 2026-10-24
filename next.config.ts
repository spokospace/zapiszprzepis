import type { NextConfig } from "next"
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"
import { imageRemotePatterns } from "./src/lib/image-remote-patterns"

const nextConfig: NextConfig = {
  turbopack: {},
  env: {
    // Versions the service worker URL (and so its caches) per build — see
    // public/sw.js. Workers Builds sets the commit SHA; local builds fall back
    // to the build time.
    NEXT_PUBLIC_SW_VERSION:
      process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 12) || Date.now().toString(36),
  },
  images: {
    remotePatterns: imageRemotePatterns(process.env.NEXT_PUBLIC_SUPABASE_URL),
  },
}

initOpenNextCloudflareForDev()

export default nextConfig

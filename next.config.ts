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
  // The sign-up page moved to its Polish slug. The old path keeps answering with a
  // redirect (query string included), per BACKWARD_COMPATIBILITY.md.
  async redirects() {
    return [{ source: "/signup", destination: "/rejestracja", permanent: true }]
  },
}

initOpenNextCloudflareForDev()

export default nextConfig

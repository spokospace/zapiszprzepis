/**
 * Public host of the `zapiszprzepis-images` R2 bucket (custom domain). Kept in
 * its own file: next.config.ts imports it through image-remote-patterns, and it
 * must not pull the Cloudflare runtime in.
 */
export const IMAGE_BASE_URL = 'https://img.zapiszprzepis.pl'

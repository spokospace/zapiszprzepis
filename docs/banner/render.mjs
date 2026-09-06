// Renders docs/banner/banner.html to docs/banner/banner-{light,dark}.webp.
// Run from the repo root: pnpm render:banner
// Requires ImageMagick (`magick`) on PATH for the WebP conversion.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(pathToFileURL(resolve(here, "banner.html")).href);
await page.evaluate(() => document.fonts.ready);

for (const colorScheme of ["light", "dark"]) {
  await page.emulateMedia({ colorScheme });
  const png = await page.locator("body").screenshot();
  const webp = execFileSync("magick", ["png:-", "-quality", "88", "-define", "webp:method=6", "webp:-"], {
    input: png,
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = resolve(here, `banner-${colorScheme}.webp`);
  writeFileSync(out, webp);
  console.log(`wrote ${out}`);
}
await browser.close();

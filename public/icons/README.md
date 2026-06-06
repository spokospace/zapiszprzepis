# PWA Icons

PWA icons must be created and placed in this directory for production deployment.

## Required Icons

1. **icon-192x192.png** (192×192 px)
   - General purpose app icon
   - Used for home screen, app switcher, etc.
   - Format: PNG with transparent background
   - Purpose: `any`

2. **icon-512x512.png** (512×512 px)
   - Large app icon
   - Used for splash screens, app stores
   - Format: PNG with transparent background
   - Purpose: `any`

3. **icon-maskable-192x192.png** (192×192 px)
   - Safe zone variant for adaptive icons (Android 8+)
   - Center 80% of the icon should be meaningful
   - Format: PNG with transparent background
   - Purpose: `maskable`

## Generation Options

### Option 1: Online Tools
- https://pwa-asset-generator.netlify.app/
- Upload `logo.svg` from project root
- Generate and download PNG files

### Option 2: Command Line (if you have imagemagick)
```bash
convert logo.svg -resize 192x192 public/icons/icon-192x192.png
convert logo.svg -resize 512x512 public/icons/icon-512x512.png
convert logo.svg -resize 192x192 public/icons/icon-maskable-192x192.png
```

### Option 3: Figma/Design Tool
- Export from design tool at 2× resolution (384x384, 1024x1024)
- Downscale to final size
- Ensure transparent background

## Testing

After adding icons:

1. Run `pnpm build`
2. Check that `dist/manifest.json` includes icon paths
3. On Pixel 9 or Android emulator:
   - Open app in Chrome
   - DevTools → Application → Manifest
   - Verify all icons load without 404 errors
   - Install prompt should appear

## Notes

- PNG format is required (not JPG, WebP, etc.)
- Transparent background recommended for flexible display
- Icon dimensions must be exact (192, 512)
- Maskable icons need safe zone (center 80%)

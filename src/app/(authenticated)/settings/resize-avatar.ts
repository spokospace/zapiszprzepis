import { AVATAR_SIZE } from '@/lib/avatar'

/**
 * Browser-only: center-crop the chosen photo to a square and re-encode it as a
 * 512² JPEG (E01-S13). Turns a 5–12 MB phone photo into ~100 kB, strips EXIF
 * (incl. GPS) and keeps the upload under the Server Action body limit — the
 * Worker cannot resize images itself. Rejects when the browser cannot decode
 * the file (e.g. HEIC outside Safari).
 */
export async function resizeAvatar(file: File): Promise<Blob> {
  // imageOrientation: honor the EXIF rotation before it is stripped.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d unavailable')
    // JPEG has no alpha: paint white under transparent PNGs instead of black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    )
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))), 'image/jpeg', 0.85),
    )
  } finally {
    bitmap.close()
  }
}

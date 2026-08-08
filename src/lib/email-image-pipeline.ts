import sharp from "sharp";

const QUALITY_STEPS = [85, 75, 65, 55, 45, 40];
const MAX_SIZE = 500 * 1024; // 500KB
const TARGET_WIDTH = 800;

// File-type validation moved to email-image-validate.ts (client-safe,
// no sharp import) — it runs in the draft editors before upload.

/**
 * Compresses an image for email: 800px width, JPEG, iterative quality reduction
 * to stay under 500KB, EXIF stripped.
 *
 * Returns the compressed JPEG buffer, or an error string.
 */
export async function compressEmailImage(
  inputBytes: ArrayBuffer
): Promise<{ buffer: Buffer } | { error: string }> {
  const originalSize = inputBytes.byteLength;

  const pipeline = sharp(Buffer.from(inputBytes))
    .rotate() // auto-orient from EXIF
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true });

  for (const quality of QUALITY_STEPS) {
    const buf = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    if (buf.byteLength <= MAX_SIZE) {
      return { buffer: buf };
    }
    if (quality === QUALITY_STEPS[QUALITY_STEPS.length - 1]) {
      return {
        error: `Image too large even at minimum quality. Original: ${(originalSize / 1024).toFixed(0)}KB, compressed: ${(buf.byteLength / 1024).toFixed(0)}KB. Please use a smaller image (target: under 500KB after compression).`,
      };
    }
  }

  return { error: "Compression failed" };
}

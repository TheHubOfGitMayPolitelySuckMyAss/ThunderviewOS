// Client-safe (no sharp import) — used by draft editors to reject
// non-image files before the direct-to-storage upload starts.
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/**
 * Validates file type for email image uploads.
 * Returns null if valid, error message string if invalid.
 */
export function validateImageType(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith(".heic")) {
    return "Only JPEG, PNG, WebP, and HEIC images are accepted";
  }
  return null;
}

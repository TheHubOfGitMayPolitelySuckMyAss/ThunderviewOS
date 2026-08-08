import { compressEmailImage } from "./email-image-pipeline";
import { createAdminClient } from "./supabase/admin";

// Direct-to-storage upload path for email images. Vercel caps request
// bodies at 4.5MB (its platform limit fires before next.config.ts's
// bodySizeLimit), so original photos never travel through a server
// action. Instead: signed upload URL → browser PUTs the original into
// tmp/ → attach action compresses from storage and deletes the temp.

const BUCKET = "email-images";
const TEMP_PATH_RE = /^tmp\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Admin = ReturnType<typeof createAdminClient>;

export async function createTempUploadTarget(
  admin: Admin
): Promise<{ path: string; token: string } | { error: string }> {
  const path = `tmp/${crypto.randomUUID()}`;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Could not create upload URL" };
  return { path: data.path, token: data.token };
}

export function isValidTempPath(path: string): boolean {
  return TEMP_PATH_RE.test(path);
}

/**
 * Downloads the browser-uploaded original from tmp/, runs the standard
 * compression pipeline, writes the result to finalPath, and deletes the
 * temp object. Returns the public URL of the compressed image.
 */
export async function compressFromTemp(
  admin: Admin,
  tempPath: string,
  finalPath: string
): Promise<{ publicUrl: string } | { error: string }> {
  try {
    const { data: blob, error: dlError } = await admin.storage.from(BUCKET).download(tempPath);
    if (dlError || !blob) {
      return { error: dlError?.message ?? "Uploaded file not found in storage" };
    }

    let result: Awaited<ReturnType<typeof compressEmailImage>>;
    try {
      result = await compressEmailImage(await blob.arrayBuffer());
    } catch (e) {
      // sharp throws on undecodable input (e.g. HEIC without libheif,
      // corrupt file) — surface it instead of letting the action 500.
      return { error: `Could not process image: ${e instanceof Error ? e.message : String(e)}` };
    }
    if ("error" in result) return result;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(finalPath, result.buffer, { contentType: "image/jpeg", upsert: false });
    if (uploadError) return { error: uploadError.message };

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(finalPath);
    return { publicUrl: urlData.publicUrl };
  } finally {
    await admin.storage.from(BUCKET).remove([tempPath]).then(
      () => {},
      () => {}
    );
  }
}

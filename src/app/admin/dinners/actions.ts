"use server";

import { createAdminClientForCurrentActor } from "@/lib/supabase/admin-with-actor";
import { revalidatePath } from "next/cache";

export async function toggleGuestsAllowed(
  dinnerId: string,
  newValue: boolean
): Promise<{ success: boolean; error?: string }> {
  const admin = await createAdminClientForCurrentActor();

  const { error } = await admin
    .from("dinners")
    .update({ guests_allowed: newValue })
    .eq("id", dinnerId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/dinners");
  return { success: true };
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Seat caps are PER DINNER: `dinners.seat_cap` (NOT NULL DEFAULT 45).
 * Enforcement reads that column — the constants here exist only for the
 * dinner-generation cron, which sets December dinners to 80 at insert.
 *
 * A "with guest" ticket occupies 2 seats (tickets.quantity); sold-out is
 * DERIVED live from active tickets rather than stored, so a refund/credit
 * drops the count and reopens sales automatically.
 *
 * Known accepted race: Stripe Checkout sessions already open when the cap
 * is reached can still complete, so the count can overshoot slightly. The
 * webhook does not decline completed payments.
 */
export const DEFAULT_SEAT_CAP = 45;
export const DECEMBER_SEAT_CAP = 80;

export function seatCapForMonth(month: number): number {
  return month === 12 ? DECEMBER_SEAT_CAP : DEFAULT_SEAT_CAP;
}

/**
 * Seats sold per dinner, counting purchased + fulfilled tickets weighted by
 * quantity. THROWS on DB errors — a failed count must never read as zero
 * (that would reopen a sold-out dinner).
 */
export async function getSeatsSoldByDinner(
  admin: SupabaseClient,
  dinnerIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (dinnerIds.length === 0) return map;

  const { data, error } = await admin
    .from("tickets")
    .select("dinner_id, quantity")
    .in("dinner_id", dinnerIds)
    .in("fulfillment_status", ["purchased", "fulfilled"]);

  if (error) {
    throw new Error(`Failed to count seats sold: ${error.message}`);
  }

  for (const t of data ?? []) {
    map.set(t.dinner_id, (map.get(t.dinner_id) ?? 0) + (t.quantity ?? 1));
  }
  return map;
}

export async function getSeatsSold(
  admin: SupabaseClient,
  dinnerId: string
): Promise<number> {
  const map = await getSeatsSoldByDinner(admin, [dinnerId]);
  return map.get(dinnerId) ?? 0;
}

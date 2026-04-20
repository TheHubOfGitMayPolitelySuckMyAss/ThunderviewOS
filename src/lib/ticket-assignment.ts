import { SupabaseClient } from "@supabase/supabase-js";
import { getTodayMT } from "./format";

/**
 * Return the next upcoming dinner (date >= today in MT, ordered ascending, limit 1).
 *
 * Used by Apply Credit and comp ticket flows. The portal purchase flow no longer
 * calls this — members pick the dinner explicitly via dropdown.
 */
export async function getTargetDinner(
  memberId: string,
  supabase: SupabaseClient
): Promise<{ id: string; date: string } | null> {
  // memberId kept in signature for backward compatibility with callers
  void memberId;

  const todayMT = getTodayMT();

  const { data: nextDinner } = await supabase
    .from("dinners")
    .select("id, date")
    .gte("date", todayMT)
    .order("date", { ascending: true })
    .limit(1)
    .single();

  return nextDinner || null;
}

/**
 * Map a member's attendee_stagetypes (array) to ticket type, label, and price.
 * Priority (first match wins):
 *   1. Active CEO → CEO Ticket, $40 (returning_ceo or new_ceo based on has_community_access)
 *   2. Investor → Investor Ticket, $100
 *   3. Exited CEO → CEO Ticket, $40
 *   4. Guest → Guest Ticket, $40
 *   5. Fallback → CEO Ticket, $40
 */
export function getTicketInfo(
  stagetypes: string[],
  hasCommunityAccess: boolean
): { ticketType: string; label: string; price: number } {
  const ceoType = hasCommunityAccess ? "returning_ceo" : "new_ceo";

  if (stagetypes.includes("Active CEO (Bootstrapping or VC-Backed)")) {
    return { ticketType: ceoType, label: "CEO Ticket", price: 40 };
  }
  if (stagetypes.includes("Investor")) {
    return { ticketType: "investor", label: "Investor Ticket", price: 100 };
  }
  if (stagetypes.includes("Exited CEO (Acquisition or IPO)")) {
    return { ticketType: ceoType, label: "CEO Ticket", price: 40 };
  }
  if (stagetypes.includes("Guest (Speaker/Press/Etc)")) {
    return { ticketType: "guest", label: "Guest Ticket", price: 40 };
  }
  return { ticketType: ceoType, label: "CEO Ticket", price: 40 };
}

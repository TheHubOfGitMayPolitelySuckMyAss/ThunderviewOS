import { SupabaseClient } from "@supabase/supabase-js";
import { getTodayMT } from "./format";

/**
 * Compute the target dinner for a member's ticket purchase.
 *
 * Logic (from handoff spec):
 * 1. If member has an approved application with preferred_dinner_date > today,
 *    AND (application.submitted_on > member.last_dinner_attended OR last_dinner_attended IS NULL),
 *    target = dinner matching preferred_dinner_date.
 * 2. Otherwise, target = next upcoming dinner (dinner date >= today in MT).
 */
export async function getTargetDinner(
  memberId: string,
  supabase: SupabaseClient
): Promise<{ id: string; date: string } | null> {
  const todayMT = getTodayMT();

  // Get member's last_dinner_attended
  const { data: member } = await supabase
    .from("members")
    .select("last_dinner_attended")
    .eq("id", memberId)
    .single();

  const lastAttended = member?.last_dinner_attended;

  // Check for approved application with future preferred_dinner_date
  const { data: apps } = await supabase
    .from("applications")
    .select("preferred_dinner_date, submitted_on")
    .eq("member_id", memberId)
    .eq("status", "approved")
    .gt("preferred_dinner_date", todayMT)
    .order("submitted_on", { ascending: false })
    .limit(1);

  if (apps && apps.length > 0) {
    const app = apps[0];
    if (!lastAttended || app.submitted_on > lastAttended) {
      const { data: dinner } = await supabase
        .from("dinners")
        .select("id, date")
        .eq("date", app.preferred_dinner_date)
        .single();
      if (dinner) return dinner;
    }
  }

  // Fall back to next upcoming dinner (dinner day itself is still "next")
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

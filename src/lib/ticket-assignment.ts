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
 * Map a member's attendee_stagetype to ticket type, label, and price.
 * CEO types split into new_ceo vs returning_ceo based on has_community_access.
 */
export function getTicketInfo(
  stagetype: string,
  hasCommunityAccess: boolean
): { ticketType: string; label: string; price: number } {
  if (stagetype === "Investor") {
    return { ticketType: "investor", label: "Investor Ticket", price: 100 };
  }
  if (stagetype === "Guest (Speaker/Press/Etc)") {
    return { ticketType: "guest", label: "Guest Ticket", price: 40 };
  }
  // Active CEO or Exited CEO
  const ticketType = hasCommunityAccess ? "returning_ceo" : "new_ceo";
  return { ticketType, label: "CEO Ticket", price: 40 };
}

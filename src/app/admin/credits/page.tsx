import { createClient } from "@/lib/supabase/server";
import CreditsTable from "./credits-table";

export default async function CreditsPage() {
  const supabase = await createClient();

  // Fetch credits with member and ticket/dinner info
  const { data: credits } = await supabase
    .from("credits")
    .select(
      "*, members(first_name, last_name, member_emails(email, is_primary)), source_ticket:tickets!source_ticket_id(dinner_id, dinners(date)), redeemed_ticket:tickets!redeemed_ticket_id(dinner_id, dinners(date))"
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-gray-900">Credits</h2>
      <CreditsTable credits={credits || []} />
    </div>
  );
}

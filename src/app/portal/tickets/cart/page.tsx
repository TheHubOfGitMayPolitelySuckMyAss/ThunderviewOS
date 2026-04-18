import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDinnerDisplay } from "@/lib/format";
import { getTargetDinner, getTicketInfo } from "@/lib/ticket-assignment";
import PurchaseButton from "./purchase-button";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ dinner_id?: string; with_guest?: string }>;
}) {
  const { with_guest } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Look up member
  const { data: memberEmail } = await supabase
    .from("member_emails")
    .select(
      "members!inner(id, attendee_stagetype, has_community_access, kicked_out)"
    )
    .eq("email", user.email!)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    id: string;
    attendee_stagetype: string | null;
    has_community_access: boolean;
    kicked_out: boolean;
  } | null;

  if (!member || member.kicked_out || !member.attendee_stagetype) {
    redirect("/portal");
  }

  const targetDinner = await getTargetDinner(member.id, supabase);
  if (!targetDinner) redirect("/portal/tickets");

  const { label, price } = getTicketInfo(
    member.attendee_stagetype,
    member.has_community_access
  );

  // Only allow guest for December dinners
  const dinnerMonth = new Date(targetDinner.date + "T00:00:00").getMonth() + 1;
  const withGuest = with_guest === "true" && dinnerMonth === 12;
  const total = withGuest ? price + 40 : price;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-center text-2xl font-bold text-gray-900">
          Review Your Order
        </h1>

        <div className="mt-8 rounded-lg bg-white p-6 shadow">
          <p className="mb-1 text-sm text-gray-500">
            {formatDinnerDisplay(targetDinner.date)}
          </p>

          {/* Line items */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-900">{label}</span>
              <span className="font-medium text-gray-900">${price}</span>
            </div>
            {withGuest && (
              <div className="flex items-center justify-between">
                <span className="text-gray-900">Guest Ticket</span>
                <span className="font-medium text-gray-900">$40</span>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-900">Total</span>
              <span className="text-lg font-bold text-gray-900">${total}</span>
            </div>
          </div>

          <div className="mt-6">
            <PurchaseButton withGuest={withGuest} />
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/portal/tickets"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Back
          </Link>
        </div>
      </div>
    </div>
  );
}

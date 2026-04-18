import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTargetDinner } from "@/lib/ticket-assignment";

export default async function GuestPage({
  searchParams,
}: {
  searchParams: Promise<{ dinner_id?: string }>;
}) {
  const { dinner_id } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Look up member
  const { data: memberEmail } = await admin
    .from("member_emails")
    .select("members!inner(id, kicked_out)")
    .eq("email", user.email!)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    id: string;
    kicked_out: boolean;
  } | null;

  if (!member || member.kicked_out) redirect("/portal");

  // Verify target dinner is December
  const targetDinner = await getTargetDinner(member.id, admin);
  if (!targetDinner) redirect("/portal/tickets");

  const dinnerMonth = new Date(targetDinner.date + "T00:00:00").getMonth() + 1;
  if (dinnerMonth !== 12) {
    redirect(`/portal/tickets/cart?dinner_id=${targetDinner.id}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">Bring a Guest?</h1>
        <p className="mt-4 text-gray-500">
          For our December dinner, you&rsquo;re welcome to bring a spouse,
          partner, or +1. Guest tickets are $40.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href={`/portal/tickets/cart?dinner_id=${targetDinner.id}&with_guest=true`}
            className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            Yes, add a guest (+$40)
          </Link>
          <Link
            href={`/portal/tickets/cart?dinner_id=${targetDinner.id}`}
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            No thanks
          </Link>
        </div>

        <Link
          href="/portal/tickets"
          className="mt-6 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back
        </Link>
      </div>
    </div>
  );
}

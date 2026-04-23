import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { formatDinnerDisplay, getTodayMT, toDateMT } from "@/lib/format";
import { H1 } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
import PortalForm from "./portal-form";
import PurchaseConfetti from "./purchase-confetti";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ purchased?: string }>;
}) {
  const { purchased } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email!;
  const admin = createAdminClient();

  const { data: memberEmail } = await admin
    .from("member_emails")
    .select(
      "members!inner(id, first_name, kicked_out, current_intro, current_ask, contact_preference, intro_updated_at, ask_updated_at, last_dinner_attended)"
    )
    .eq("email", email)
    .limit(1)
    .single();

  const member = memberEmail?.members as unknown as {
    id: string;
    first_name: string;
    kicked_out: boolean;
    current_intro: string | null;
    current_ask: string | null;
    contact_preference: string | null;
    intro_updated_at: string | null;
    ask_updated_at: string | null;
    last_dinner_attended: string | null;
  } | null;

  const isMember = member !== null && member.kicked_out === false;

  // Fetch next future ticket for banner
  let bannerDinnerDate: string | null = null;
  let introAskFresh = false;
  if (isMember) {
    const todayMT = getTodayMT();
    const { data: futureTicket } = await admin
      .from("tickets")
      .select("dinners!inner(date)")
      .eq("member_id", member.id)
      .in("fulfillment_status", ["purchased", "fulfilled"])
      .gte("dinners.date", todayMT)
      .order("dinners(date)", { ascending: true })
      .limit(1)
      .single();

    if (futureTicket) {
      const dinner = futureTicket.dinners as unknown as { date: string };
      bannerDinnerDate = dinner.date;

      const lda = member.last_dinner_attended;
      const introDate = member.intro_updated_at ? toDateMT(member.intro_updated_at) : null;
      const askDate = member.ask_updated_at ? toDateMT(member.ask_updated_at) : null;
      const introTouched = introDate && (!lda || introDate > lda);
      const askTouched = askDate && (!lda || askDate > lda);
      introAskFresh = !!(introTouched || askTouched);
    }
  }

  return (
    <div className="tv-container-narrow tv-page-gutter py-7">
      <H1 className="mb-6">
        {member?.first_name ? `Welcome back, ${member.first_name}.` : "Portal"}
      </H1>

      {isMember && bannerDinnerDate && (
        <div className="rounded-lg border border-accent-soft bg-bg-elevated px-5 py-3.5 flex items-center gap-3 mb-6">
          <Check size={18} className="text-accent flex-shrink-0" />
          <span className="text-sm text-fg2 leading-[1.5]">
            You&rsquo;re confirmed for <strong className="text-fg1">{formatDinnerDisplay(bannerDinnerDate)}</strong>.
          </span>
        </div>
      )}

      {isMember && (
        <Card>
          <PortalForm
            initialIntro={member.current_intro}
            initialAsk={member.current_ask}
            initialContact={member.contact_preference}
            bannerDinnerDate={bannerDinnerDate ? formatDinnerDisplay(bannerDinnerDate) : null}
            bannerIntroAskFresh={introAskFresh}
          />
        </Card>
      )}

      <p className="text-xs text-fg3 mt-5 text-center">
        Need to update your name, company, or photo?{" "}
        <Link href="/portal/profile" className="text-accent-hover hover:underline">
          Edit your profile
        </Link>
      </p>

      {purchased === "true" && <PurchaseConfetti />}
    </div>
  );
}

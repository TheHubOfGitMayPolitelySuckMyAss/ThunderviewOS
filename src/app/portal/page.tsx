import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDinnerDisplay, getTodayMT, toDateMT } from "@/lib/format";
import { H1, Body } from "@/components/ui/typography";
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

  const navButtons = [
    ...(isMember ? [{ href: "/portal/tickets", label: "Buy a dinner ticket" }] : []),
    { href: "/portal/profile", label: "Update your profile" },
    { href: "/portal/community", label: "View the community" },
    { href: "/portal/recap", label: "Check last month\u2019s intros & asks" },
  ];

  return (
    <div className="max-w-[980px] mx-auto tv-page-gutter py-10">
      <H1 className="mb-1.5">
        {member?.first_name ? `Welcome back, ${member.first_name}.` : "Portal"}
      </H1>
      {bannerDinnerDate && (
        <Body className="mb-8">
          You&rsquo;re coming to the {formatDinnerDisplay(bannerDinnerDate)} dinner. Here&rsquo;s your corner of Thunderview.
        </Body>
      )}
      {!bannerDinnerDate && <div className="mb-8" />}

      <div className="grid gap-7 md:grid-cols-[1fr_1.2fr]">
        {/* Left column: navigation buttons */}
        <div>
          {navButtons.map((btn) => (
            <Link
              key={btn.href}
              href={btn.href}
              className="flex items-center justify-between px-[22px] py-[18px] bg-bg-elevated border border-border rounded-lg text-fg1 font-medium text-base no-underline mb-2.5 transition-all duration-150 hover:bg-bg-tinted hover:translate-x-0.5"
            >
              {btn.label}
              <ChevronRight size={16} className="text-fg3" />
            </Link>
          ))}
        </div>

        {/* Right column: inline edit form */}
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
      </div>

      {purchased === "true" && <PurchaseConfetti />}
    </div>
  );
}

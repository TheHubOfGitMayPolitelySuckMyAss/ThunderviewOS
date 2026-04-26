import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT, formatDinnerDisplay } from "@/lib/format";
import PublicNav from "@/components/public-nav";
import { H1, H3, Eyebrow, Body } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AboutPage() {
  const admin = createAdminClient();
  const todayMT = getTodayMT();

  // Next 12 months of dinners
  const { data: dinners } = await admin
    .from("dinners")
    .select("date")
    .gte("date", todayMT)
    .order("date", { ascending: true })
    .limit(12);

  const nextDinnerDate = dinners?.[0]?.date ?? null;

  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />

      <section className="tv-paper">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section">
          <div className="max-w-[640px] mx-auto">
            <H1 className="mb-section">About Thunderview.</H1>

            {/* ---- What Thunderview is ---- */}
            <div className="mb-section">
              <Eyebrow className="mb-3">What Thunderview Is</Eyebrow>
              <div className="space-y-stack">
                <Body>
                  &ldquo;Startup CEO&rdquo; is one of the greatest jobs out there. You have the
                  opportunity to make an impact, you face new challenges on a daily basis,
                  you get to test your vision of the world, for real money, in the market.
                </Body>
                <Body>
                  It&rsquo;s also one of the loneliest jobs to have. There&rsquo;s a mountain
                  of stress that you can&rsquo;t share with your employees, board or significant
                  other. Even if you have co-founders, sometimes you just need to move out of
                  your bubble and get an unbiased point of view.
                </Body>
                <Body>
                  Thunderview CEO Dinners is a monthly dinner founded to introduce a diverse set
                  of CEOs &mdash; across backgrounds, stages and markets &mdash; to one another to share
                  their experiences and receive outside perspectives.
                </Body>
                <Body>
                  Each dinner is capped at 50 participants &mdash; a mix of early-stage, scaling,
                  exited and bootstrapping CEOs, plus a few VCs to provide capital&rsquo;s point
                  of view, with a strong focus on representation for traditionally underrepresented
                  founders. We help each other, celebrate wins and work together to solve hard problems.
                </Body>
              </div>
            </div>

            {/* ---- Dinner format ---- */}
            <div className="mb-section">
              <Eyebrow className="mb-3">Dinner Format</Eyebrow>
              <Card className="mb-stack">
                <div className="space-y-2">
                  <div className="flex gap-4">
                    <span className="text-[14px] font-semibold text-fg1 w-[52px] flex-shrink-0">6:00p</span>
                    <span className="text-[14px] text-fg2">Drinks and mingle</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-[14px] font-semibold text-fg1 w-[52px] flex-shrink-0">6:30p</span>
                    <span className="text-[14px] text-fg2">Introductions (bring an Ask other than investment)</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-[14px] font-semibold text-fg1 w-[52px] flex-shrink-0">7:00p</span>
                    <span className="text-[14px] text-fg2">Dinner (organized by interests)</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-[14px] font-semibold text-fg1 w-[52px] flex-shrink-0">8:00p</span>
                    <span className="text-[14px] text-fg2">Main presentation</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-[14px] font-semibold text-fg1 w-[52px] flex-shrink-0">9:00p</span>
                    <span className="text-[14px] text-fg2">Mingle until close</span>
                  </div>
                </div>
              </Card>
              <H3 className="mb-1.5">ID345</H3>
              <Body className="text-fg3 mb-1.5">3960 High St, Denver, CO 80205</Body>
              <Body>
                Colorado&rsquo;s launchpad for AI builders and bold ideas &mdash; a 5,000 sq ft
                shell of steel and possibility. They host weekly buildathons, founder AMAs and demo
                nights where VCs, cloud sponsors, and Colorado grant officers scout new talent.
              </Body>
            </div>

            {/* ---- Upcoming dinners ---- */}
            <div className="mb-section">
              <Eyebrow className="mb-3">Upcoming Dinners</Eyebrow>
              <Body className="mb-stack text-fg3">
                First Thursday of every month. January and July are off.
              </Body>
              {dinners && dinners.length > 0 ? (
                <Card>
                  <div className="space-y-1.5">
                    {dinners.map((d) => {
                      const isNext = d.date === nextDinnerDate;
                      return (
                        <div
                          key={d.date}
                          className={`text-[14px] py-1 ${isNext ? "font-semibold text-fg1" : "text-fg2"}`}
                        >
                          {formatDinnerDisplay(d.date)}
                          {isNext && (
                            <span className="ml-2 text-xs font-semibold uppercase tracking-[0.1em] text-accent-hover">
                              Next
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : (
                <Body className="text-fg3">No upcoming dinners scheduled.</Body>
              )}
            </div>

            {/* ---- Diversity commitment ---- */}
            <div className="mb-section">
              <Eyebrow className="mb-3">Our Commitment</Eyebrow>
              <Body className="mb-stack">
                We value CEOs from diverse backgrounds and helpful members of the community.
              </Body>
              <Body className="mb-stack">In practice this means the following:</Body>
              <ul className="list-disc pl-5 space-y-2 text-[16px] leading-[1.6] text-fg2">
                <li>
                  Priority invites go to historically underrepresented CEOs. We backfill
                  with traditionally represented CEOs.
                </li>
                <li>
                  Once you&rsquo;ve attended, we ask that you do two things to secure an
                  invite to a future dinner &mdash; help someone with an Ask and refer a new
                  CEO to the group.
                </li>
              </ul>
            </div>

            {/* ---- CTA ---- */}
            <div className="text-center">
              <Button size="lg" asChild>
                <Link href="/apply">Sign Up Now</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border-subtle py-7 text-center text-[13px] text-fg3">
        Thunderview CEO Dinners
        <span className="text-fg4 mx-2">&middot;</span>
        Denver, Colorado
        <span className="text-fg4 mx-2">&middot;</span>
        team@thunderviewceodinners.com
      </footer>
    </div>
  );
}

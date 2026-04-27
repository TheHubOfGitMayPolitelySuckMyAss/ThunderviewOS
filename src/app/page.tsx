import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT, formatDinnerDisplay } from "@/lib/format";
import PublicNav from "@/components/public-nav";
import { Button } from "@/components/ui/button";
import { Eyebrow, H1, H2, H3, Body, Small } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
import ThisMonthsDinner from "./_components/this-months-dinner";

export const metadata: Metadata = {
  title: "Thunderview CEO Dinners — Monthly dinners for Colorado startup CEOs",
  description:
    "Every attendee is vetted. No service providers, no job-seekers. CEOs are peers, not products. Monthly dinners in Denver for founders of product and software companies.",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;

  const admin = createAdminClient();
  const { data: nextDinner } = await admin
    .from("dinners")
    .select("date")
    .gte("date", getTodayMT())
    .order("date", { ascending: true })
    .limit(1)
    .single();

  const nextDinnerLabel = nextDinner
    ? `Next Dinner: ${formatDinnerDisplay(nextDinner.date)}`
    : "Next Dinner: First Thursday of the month.";

  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />

      {/* ---- Hero ---- */}
      <section className="tv-paper">
        <div className="max-w-[1120px] mx-auto tv-page-gutter pt-8 pb-7">
          <div className="max-w-[820px] mb-7">
            <Eyebrow className="!text-accent-hover mb-5">Monthly CEO Dinners · Denver, Colorado</Eyebrow>
            <H1 className="mb-7 max-w-[900px]">
              Monthly dinners for Colorado startup CEOs.
            </H1>
            <Body className="!text-[19px] !leading-[1.55] max-w-[620px] mb-8">
              Every attendee is vetted. No service providers, no job-seekers. CEOs are peers, not products. One room, 40 CEOs, one evening a month.
            </Body>

            <div className="flex gap-3 mb-7">
              {isAuthenticated ? (
                <Button size="lg" asChild>
                  <Link href="/portal/tickets">Buy A Dinner Ticket</Link>
                </Button>
              ) : (
                <Button size="lg" asChild>
                  <Link href="/apply">Apply To Join</Link>
                </Button>
              )}
            </div>

            <div className="flex gap-7 text-[13px] text-fg3">
              {/* TODO(eric): confirm copy — pull live counts from DB? */}
              <div>
                <span className="block font-display font-medium text-[32px] text-fg1 mb-0.5" style={{ fontVariationSettings: '"opsz" 72' }}>35+</span>
                dinners so far
              </div>
              <div>
                <span className="block font-display font-medium text-[32px] text-fg1 mb-0.5" style={{ fontVariationSettings: '"opsz" 72' }}>630+</span>
                vetted members
              </div>
              <div>
                <span className="block font-display font-medium text-[32px] text-fg1 mb-0.5" style={{ fontVariationSettings: '"opsz" 72' }}>3 yrs</span>
                running strong
              </div>
            </div>
          </div>

          {/* Hero photo */}
          <div className="relative aspect-video rounded-[16px] overflow-hidden shadow-lg">
            <Image
              src="/brand/photos/dinner-03-two-guys-pointing.webp"
              alt="Two CEOs at a Thunderview dinner"
              fill
              className="object-cover"
              style={{ objectPosition: "30% 40%" }}
              priority
            />
          </div>
        </div>
      </section>

      {/* ---- This month's dinner ---- */}
      <ThisMonthsDinner />

      {/* ---- Three reasons ---- */}
      <section className="border-t border-border-subtle">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section">
          <H2 className="mb-7 max-w-[680px]">
            {/* TODO(eric): confirm copy */}
            Why CEOs keep coming back.
          </H2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            <Card>
              <span className="block font-display italic text-[36px] text-accent font-medium leading-none mb-4">01</span>
              <H3 className="mb-2.5">A room that gets it</H3>
              <p className="text-[14.5px] leading-[1.55] text-fg2 m-0">
                {/* TODO(eric): confirm copy */}
                Every attendee is vetted. No service providers, no job-seekers. CEOs are peers, not products. One room, 40 CEOs, one evening a month.
              </p>
            </Card>
            <Card>
              <span className="block font-display italic text-[36px] text-accent font-medium leading-none mb-4">02</span>
              <H3 className="mb-2.5">Structured to connect</H3>
              <p className="text-[14.5px] leading-[1.55] text-fg2 m-0">
                {/* TODO(eric): confirm copy */}
                Not a mixer. Before each dinner, everyone gets the full list of attendees and their asks. Introductions are built in. There&rsquo;s always a speaker. The right conversations happen by design.
              </p>
            </Card>
            <Card variant="feature">
              <span className="block font-display italic text-[36px] text-accent font-medium leading-none mb-4">03</span>
              <H3 className="mb-2.5">More than a dinner</H3>
              <p className="text-[14.5px] leading-[1.55] text-fg2 m-0">
                {/* TODO(eric): confirm copy */}
                Between events, members keep showing up — making intros, answering questions, helping each other. You&rsquo;re not attending an event. You&rsquo;re joining a community.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ---- Photo gallery ---- */}
      <section className="border-t border-border-subtle">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section">
          <H2 className="mb-7">Scenes from the last three years.</H2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            <figure className="m-0 aspect-[4/3] rounded-xl overflow-hidden border border-border bg-bg-elevated">
              <Image src="/brand/photos/dinner-10-laughing-pair.webp" alt="Two CEOs laughing" fill className="!relative object-cover w-full h-full" />
            </figure>
            <figure className="m-0 aspect-[4/3] rounded-xl overflow-hidden border border-border bg-bg-elevated">
              <Image src="/brand/photos/dinner-01-conversation.webp" alt="Candid conversation at dinner" fill className="!relative object-cover w-full h-full" style={{ objectPosition: "left center" }} />
            </figure>
            <figure className="m-0 aspect-[4/3] rounded-xl overflow-hidden border border-border bg-bg-elevated">
              <Image src="/brand/photos/dinner-05-panel-audience.webp" alt="Audience at a Thunderview dinner" fill className="!relative object-cover w-full h-full" style={{ objectPosition: "center 40%" }} />
            </figure>
            <figure className="m-0 aspect-[4/3] rounded-xl overflow-hidden border border-border bg-bg-elevated">
              <Image src="/brand/photos/dinner-11-wave-hello.webp" alt="A wave hello" fill className="!relative object-cover w-full h-full" style={{ objectPosition: "center 45%" }} />
            </figure>
            <figure className="m-0 aspect-[4/3] rounded-xl overflow-hidden border border-border bg-bg-elevated">
              <Image src="/brand/photos/dinner-12-bigfoot-mural.webp" alt="Bigfoot mural at the venue" fill className="!relative object-cover w-full h-full" style={{ objectPosition: "center 55%" }} />
            </figure>
            <figure className="m-0 aspect-[4/3] rounded-xl overflow-hidden border border-border bg-bg-elevated">
              <Image src="/brand/photos/dinner-04-green-vest.webp" alt="CEO in a green vest" fill className="!relative object-cover w-full h-full" />
            </figure>
          </div>
        </div>
      </section>

      {/* ---- Quote ---- */}
      <section className="border-t border-border-subtle">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section">
          <div className="bg-bg-elevated rounded-xl p-7 md:px-8 text-center shadow-glow border border-transparent">
            <p className="font-display italic font-normal text-[32px] leading-[1.3] text-fg1 max-w-[780px] mx-auto mb-6" style={{ textWrap: "balance" }}>
              &ldquo;We start companies because we can&rsquo;t help ourselves. The smart founders find a room full of people who are just as crazy and want to help.&rdquo;
            </p>
            <p className="text-[13px] text-fg3 tracking-[0.1em] uppercase">
              &mdash; Eric Marcoullier, Founding Director
            </p>
          </div>
        </div>
      </section>

      {/* ---- Bottom CTA ---- */}
      <section className="border-t border-border-subtle">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section text-center">
          <H2 className="mx-auto mb-7">{nextDinnerLabel}</H2>
          {isAuthenticated ? (
            <Button size="lg" asChild>
              <Link href="/portal/tickets">Buy A Dinner Ticket</Link>
            </Button>
          ) : (
            <Button size="lg" asChild>
              <Link href="/apply">Apply To Attend</Link>
            </Button>
          )}
        </div>
      </section>

      {/* ---- Footer ---- */}
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

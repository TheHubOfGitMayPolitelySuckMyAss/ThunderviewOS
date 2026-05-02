import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import PublicNav from "@/components/public-nav";
import { H1, H3, Eyebrow } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

const OFF_MONTHS = [1, 7]; // January, July

const schedule = [
  { time: "6:00p", label: "Drinks and mingle" },
  { time: "6:30p", label: "Introductions (bring an Ask other than investment)" },
  { time: "7:00p", label: "Dinner (organized by interests)" },
  { time: "8:00p", label: "Main presentation" },
  { time: "9:00p", label: "Mingle until close" },
];

type DinnerRow =
  | { type: "dinner"; date: string; day: number; month: string; year: number; isNext: boolean }
  | { type: "off"; month: string; year: number };

function buildDinnerList(dinners: { date: string }[], nextDate: string | null): DinnerRow[] {
  const rows: DinnerRow[] = [];
  const seen = new Set<string>();

  for (const d of dinners) {
    const dt = new Date(d.date + "T00:00:00");
    const m = dt.getMonth() + 1;
    const y = dt.getFullYear();

    // Insert off-month rows for any skipped Jan/Jul before this dinner
    for (const offMonth of OFF_MONTHS) {
      let offYear = y;
      if (offMonth > m) offYear = y; // same year
      else if (offMonth < m) offYear = y; // same year, already passed — check if we already inserted
      const key = `off-${offYear}-${offMonth}`;
      if (!seen.has(key)) {
        const offDate = new Date(offYear, offMonth - 1, 1);
        // Only insert if the off month falls within our range
        if (offDate >= new Date(dinners[0].date + "T00:00:00") && offDate <= new Date(dinners[dinners.length - 1].date + "T00:00:00")) {
          seen.add(key);
        }
      }
    }

    rows.push({
      type: "dinner",
      date: d.date,
      day: dt.getDate(),
      month: dt.toLocaleDateString("en-US", { month: "long" }),
      year: y,
      isNext: d.date === nextDate,
    });
  }

  // Now insert off-month rows in chronological order
  const firstDt = new Date(dinners[0].date + "T00:00:00");
  const lastDt = new Date(dinners[dinners.length - 1].date + "T00:00:00");

  for (const offMonth of OFF_MONTHS) {
    // Check each year in range
    for (let y = firstDt.getFullYear(); y <= lastDt.getFullYear(); y++) {
      const offDt = new Date(y, offMonth - 1, 15); // mid-month for comparison
      if (offDt > firstDt && offDt < lastDt) {
        const monthName = offDt.toLocaleDateString("en-US", { month: "long" });
        rows.push({ type: "off", month: monthName, year: y });
      }
    }
  }

  // Sort everything chronologically
  rows.sort((a, b) => {
    const aKey = a.type === "dinner" ? a.date : `${a.year}-${String(a.month === "January" ? 1 : 7).padStart(2, "0")}-15`;
    const bKey = b.type === "dinner" ? b.date : `${b.year}-${String(b.month === "January" ? 1 : 7).padStart(2, "0")}-15`;
    return aKey.localeCompare(bKey);
  });

  return rows;
}

export default async function AboutPage() {
  const admin = createAdminClient("public-flow");
  const todayMT = getTodayMT();

  const { data: dinners } = await admin
    .from("dinners")
    .select("date")
    .gte("date", todayMT)
    .order("date", { ascending: true })
    .limit(12);

  const nextDinnerDate = dinners?.[0]?.date ?? null;
  const dinnerRows = dinners && dinners.length > 0 ? buildDinnerList(dinners, nextDinnerDate) : [];

  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />

      {/* ---- Hero ---- */}
      <section className="tv-paper">
        <div className="max-w-[1120px] mx-auto tv-page-gutter grid grid-cols-1 gap-stack items-center py-section min-[900px]:grid-cols-[1fr_0.95fr] min-[900px]:gap-section">
          <div>
            <H1 className="mb-stack">About Thunderview.</H1>
            <p className="text-[19px] leading-[1.55] text-fg2 italic opacity-60 max-w-[520px]" style={{ textWrap: "pretty" as never }}>
              Thunderview CEO Dinners is a monthly dinner in Denver for startup CEOs. Each dinner is capped at 40 people. The format runs three hours: introductions where each attendee brings a non-investment Ask, dinner where attendees can dive deep into business issues, and a main presentation. The point is to give CEOs a room of peers who aren't their employees, board, or co-founders — people who can offer an unbiased outside perspective on the problems they're carrying.
            </p>
          </div>
          <div className="aspect-[4/5] rounded-lg overflow-hidden shadow-lg">
            <Image
              src="/brand/photos/dinner-05-panel-audience.webp"
              alt="Audience at a Thunderview dinner"
              fill
              className="!relative object-cover w-full h-full"
              style={{ objectPosition: "center 40%" }}
              priority
            />
          </div>
        </div>
      </section>

      {/* ---- What Thunderview Is ---- */}
      <section className="border-t border-border-subtle">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section">
          <Eyebrow className="mb-3">What Thunderview Is</Eyebrow>
          <div className="max-w-[720px] space-y-[18px]">
            <p className="text-[17px] leading-[1.6] text-fg2" style={{ textWrap: "pretty" as never }}>
              &ldquo;Startup CEO&rdquo; is one of the greatest jobs out there. You have the
              opportunity to make an impact, you face new challenges on a daily basis,
              you get to test your vision of the world, for real money, in the market.
            </p>
            <p className="text-[17px] leading-[1.6] text-fg2" style={{ textWrap: "pretty" as never }}>
              It&rsquo;s also one of the loneliest jobs to have. There&rsquo;s a mountain
              of stress that you can&rsquo;t share with your employees, board or significant
              other. Even if you have co-founders, sometimes you just need to move out of
              your bubble and get an unbiased point of view.
            </p>
            <p className="text-[17px] leading-[1.6] text-fg2" style={{ textWrap: "pretty" as never }}>
              Thunderview CEO Dinners is a monthly dinner founded to introduce a diverse set
              of CEOs &mdash; across backgrounds, stages and markets &mdash; to one another to share
              their experiences and receive outside perspectives.
            </p>
            <p className="text-[17px] leading-[1.6] text-fg2" style={{ textWrap: "pretty" as never }}>
              Each dinner is capped at 40 participants &mdash; a mix of early-stage, scaling,
              exited and bootstrapping CEOs, plus a few VCs to provide capital&rsquo;s point
              of view, with a strong focus on representation for traditionally underrepresented
              founders. We help each other, celebrate wins and work together to solve hard problems.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Dinner Format ---- */}
      <section className="border-t border-border-subtle bg-bg-elevated">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section">
          <Eyebrow className="mb-3">Dinner Format</Eyebrow>
          <div className="grid grid-cols-1 gap-stack min-[900px]:grid-cols-2 min-[900px]:gap-section">
            {/* Schedule timeline */}
            <div>
              {schedule.map((row, i) => (
                <div
                  key={row.time}
                  className={`grid grid-cols-[72px_12px_1fr] items-baseline gap-4 py-3.5 ${i < schedule.length - 1 ? "border-b border-border-subtle" : ""}`}
                >
                  <span className="font-display font-medium text-[20px] text-fg1 tracking-[-0.01em]" style={{ fontVariationSettings: '"opsz" 72' }}>
                    {row.time}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-accent self-center justify-self-center" />
                  <span className="text-[15.5px] text-fg2 leading-[1.4]">{row.label}</span>
                </div>
              ))}
            </div>
            {/* Venue */}
            <div>
              <H3 className="mb-1">ID345</H3>
              <p className="text-[14px] text-fg3 mb-4">3960 High St, Denver, CO 80205</p>
              <p className="text-[16px] leading-[1.6] text-fg2" style={{ textWrap: "pretty" as never }}>
                Colorado&rsquo;s launchpad for AI builders and bold ideas &mdash; a 5,000 sq ft
                shell of steel and possibility. They host weekly buildathons, founder AMAs and demo
                nights where VCs, cloud sponsors, and Colorado grant officers scout new talent.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Upcoming Dinners ---- */}
      <section className="border-t border-border-subtle">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section">
          <Eyebrow className="mb-3">Upcoming Dinners</Eyebrow>
          <p className="text-[15px] text-fg3 mb-7 max-w-[680px]">
            First Thursday of every month. In case you can&rsquo;t make the next dinner,
            please sign up for the first one that works with your schedule.
          </p>
          {dinnerRows.length > 0 && (
            <ul className="max-w-[520px] list-none p-0 m-0">
              {dinnerRows.map((row) => {
                if (row.type === "off") {
                  return (
                    <li key={`off-${row.month}-${row.year}`} className="grid grid-cols-[64px_1fr] items-center gap-5 py-3.5 border-b border-border-subtle opacity-70">
                      <div className="flex flex-col items-center justify-center w-[64px] h-[64px] rounded-lg bg-transparent border border-dashed border-border-subtle">
                        <span className="font-semibold text-[10px] uppercase tracking-[0.14em] text-fg3 mb-1">Off</span>
                        <span className="font-display font-medium text-[26px] text-fg3 italic leading-none" style={{ fontVariationSettings: '"opsz" 144' }}>&mdash;</span>
                      </div>
                      <span className="text-[16px] text-fg3 italic">{row.month} {row.year} &mdash; Off!</span>
                    </li>
                  );
                }
                return (
                  <li
                    key={row.date}
                    className={`grid items-center gap-5 py-3.5 border-b border-border-subtle ${row.isNext ? "grid-cols-[64px_1fr_auto]" : "grid-cols-[64px_1fr]"}`}
                  >
                    <div className={`flex flex-col items-center justify-center w-[64px] h-[64px] rounded-lg border ${row.isNext ? "bg-bg border-accent shadow-glow" : "bg-bg-elevated border-border-subtle"}`}>
                      <span className={`font-semibold text-[10px] uppercase tracking-[0.14em] mb-1 ${row.isNext ? "text-accent-hover" : "text-fg3"}`}>Thu</span>
                      <span className="font-display font-medium text-[26px] text-fg1 leading-none tracking-[-0.015em]" style={{ fontVariationSettings: '"opsz" 144' }}>{row.day}</span>
                    </div>
                    <div className="text-[16px] font-medium text-fg1 leading-[1.3]">
                      <span>{row.month}</span>
                      <span className="text-fg3 font-normal ml-1.5">{row.year}</span>
                    </div>
                    {row.isNext && (
                      <span className="font-semibold text-[10px] uppercase tracking-[0.14em] text-accent-hover">Next</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ---- Our Commitment ---- */}
      <section className="border-t border-border-subtle bg-bg-elevated">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section">
          <Eyebrow className="mb-3">Our Commitment</Eyebrow>
          <div className="max-w-[720px]">
            <p className="text-[17px] leading-[1.6] text-fg2 mb-[18px]" style={{ textWrap: "pretty" as never }}>
              We value CEOs from diverse backgrounds and helpful members of the community.
            </p>
            <p className="text-[17px] leading-[1.6] text-fg2 mb-[18px]" style={{ textWrap: "pretty" as never }}>
              In practice this means the following:
            </p>
            <ul className="list-none p-0 m-0 flex flex-col gap-[18px]">
              <li className="relative pl-8 text-[17px] leading-[1.6] text-fg2 before:content-[''] before:absolute before:left-2 before:top-[11px] before:w-2 before:h-2 before:rounded-full before:bg-accent" style={{ textWrap: "pretty" as never }}>
                Priority invites go to historically underrepresented CEOs. We backfill
                with traditionally represented CEOs.
              </li>
              <li className="relative pl-8 text-[17px] leading-[1.6] text-fg2 before:content-[''] before:absolute before:left-2 before:top-[11px] before:w-2 before:h-2 before:rounded-full before:bg-accent" style={{ textWrap: "pretty" as never }}>
                Once you&rsquo;ve attended, we ask that you do two things to secure an
                invite to a future dinner &mdash; help someone with an Ask and refer a new
                CEO to the group.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="border-t border-border-subtle">
        <div className="max-w-[1120px] mx-auto tv-page-gutter py-section text-center">
          <Button size="lg" asChild>
            <Link href="/apply">Sign Up Now</Link>
          </Button>
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

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import PublicNav from "@/components/public-nav";
import { Eyebrow } from "@/components/ui/typography";
import ApplicationForm from "./application-form";

function ordinalDay(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

function formatDinnerDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = ordinalDay(d.getDate());
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}

export default async function ApplyPage() {
  const supabase = createAdminClient();
  const today = getTodayMT();

  // Fetch all dinners from today onward
  const { data: dinners } = await supabase
    .from("dinners")
    .select("id, date")
    .gte("date", today)
    .order("date", { ascending: true });

  const allDinners = dinners || [];

  // Next dinner date for the intro text
  const nextDinnerDate = allDinners[0]
    ? formatDinnerDate(allDinners[0].date)
    : "next";

  // Build 12-month schedule starting from current month in MT
  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const currentYear = parseInt(nowParts.find((p) => p.type === "year")!.value);
  const currentMonth = parseInt(nowParts.find((p) => p.type === "month")!.value);

  // Map dinners by YYYY-MM for lookup
  const dinnersByMonth: Record<string, string> = {};
  for (const d of allDinners) {
    const key = d.date.slice(0, 7); // YYYY-MM
    if (!dinnersByMonth[key]) {
      dinnersByMonth[key] = d.date;
    }
  }

  const schedule: { label: string; isOff: boolean }[] = [];
  for (let i = 0; i < 13; i++) {
    let m = currentMonth + i;
    let y = currentYear;
    if (m > 12) {
      m -= 12;
      y += 1;
    }
    const monthName = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
      month: "long",
    });

    if (m === 1 || m === 7) {
      schedule.push({ label: `${monthName} ${y} — Off!`, isOff: true });
    } else {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const dinnerDate = dinnersByMonth[key];
      if (dinnerDate) {
        schedule.push({ label: formatDinnerDate(dinnerDate), isOff: false });
      } else {
        console.warn(`No dinner found for ${key}`);
      }
    }
  }

  return (
    <div className="tv-surface min-h-screen">
      <PublicNav />
      <div className="mx-auto max-w-[680px] tv-page-gutter pt-8 pb-9">
        {/* Header */}
        <div className="mb-6">
          <Eyebrow className="mb-2.5">Apply to attend</Eyebrow>
          <h1 className="font-display font-medium text-[44px] leading-[1.05] tracking-[-0.015em] mb-4" style={{ fontVariationSettings: '"opsz" 144' }}>
            Sign Up to Attend a CEO Dinner
          </h1>
          <div className="text-[16px] leading-[1.55] text-fg2 space-y-4" style={{ textWrap: "pretty" }}>
            <p>
              If you are interested in attending a dinner, please fill out the
              following form. When you are selected, we&rsquo;ll send you a URL
              and invite code that you can use on this web site to purchase your
              ticket. CEO tickets are $40 and VC tickets are $100.
            </p>
            <p>
              If you can&rsquo;t afford the dinner ticket (it happens), send an
              email to{" "}
              <a
                href="mailto:eric@marcoullier.com"
                className="text-accent-hover underline decoration-border"
              >
                eric@marcoullier.com
              </a>{" "}
              and we&rsquo;ll make it work.
            </p>
            <p>
              Please note that all information provided will be held in strict
              confidence and is only used to ensure we have a balanced and diverse
              group of dinner attendees. Historically underrepresented founders get
              first access to tickets each month. We won&rsquo;t share, sell or
              distribute your information to anyone else.
            </p>
            <p>
              In case you can&rsquo;t make the {nextDinnerDate} dinner, our
              upcoming schedule is listed below. All dinners will be held at the
              Mercury Cafe in Denver and run from 6p to 9p. Please sign up for the
              first dinner that works with your schedule.
            </p>
          </div>
        </div>

        {/* Schedule panel */}
        <div className="bg-bg-elevated border border-border-subtle rounded-lg px-6 py-5 mb-8">
          <h3 className="font-sans font-semibold text-[11px] uppercase tracking-[0.12em] text-fg3 mb-3">
            Upcoming schedule
          </h3>
          <ul className="list-none p-0 m-0 columns-2 max-sm:columns-1" style={{ columnGap: "32px" }}>
            {schedule.map((s, i) => (
              <li
                key={i}
                className={`text-[14px] py-1 break-inside-avoid ${s.isOff ? "italic text-fg4" : "text-fg1"}`}
              >
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        <ApplicationForm />
      </div>
    </div>
  );
}

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayMT } from "@/lib/format";
import PublicNav from "@/components/public-nav";
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
  for (let i = 0; i < 12; i++) {
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
    <div className="tv-surface tv-paper min-h-screen">
      <PublicNav />
      <div className="mx-auto max-w-[640px] tv-page-gutter pt-8 pb-9">
        <h1 className="tv-h2 !text-[44px] mb-3">Apply to attend.</h1>
        <p className="text-[17px] text-fg2 leading-[1.5] mb-7" style={{ textWrap: "pretty" }}>
          Every dinner is vetted. This form is how we learn who you are. It takes two minutes,
          it&rsquo;s not a quiz, and we&rsquo;ll be in touch within a week.
        </p>

        <div className="space-y-form-row text-[14px] text-fg2 leading-relaxed mb-7">
          <p>
            CEO tickets are $40 and VC tickets are $100.
            If you can&rsquo;t afford the dinner ticket (it happens), send an email to{" "}
            <a href="mailto:eric@marcoullier.com" className="text-accent-hover underline decoration-border">
              eric@marcoullier.com
            </a>{" "}
            and we&rsquo;ll make it work.
          </p>
          <p>
            All information provided will be held in strict confidence and is only used to ensure
            we have a balanced and diverse group of dinner attendees. Historically underrepresented
            founders get first access to tickets each month.
          </p>
          <p>
            In case you can&rsquo;t make the {nextDinnerDate} dinner, our upcoming schedule
            is listed below.
          </p>
        </div>

        {/* Dinner schedule */}
        <ul className="space-y-1 mb-7">
          {schedule.map((s, i) => (
            <li
              key={i}
              className={`text-sm ${s.isOff ? "italic text-fg4" : "text-fg2"}`}
            >
              {s.label}
            </li>
          ))}
        </ul>

        <ApplicationForm />
      </div>
    </div>
  );
}

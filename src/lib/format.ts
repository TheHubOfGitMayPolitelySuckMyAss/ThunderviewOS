/** Concatenate first_name + last_name for display. */
export function formatName(first_name: string, last_name: string): string {
  return last_name ? `${first_name} ${last_name}` : first_name;
}

/** Display-friendly stage/type labels. Stored values are unchanged. */
export function formatStageType(raw: string | null | undefined): string {
  if (!raw) return "-";
  if (raw === "Active CEO (Bootstrapping or VC-Backed)") return "Active CEO";
  if (raw === "Exited CEO (Acquisition or IPO)") return "Exited CEO";
  return raw;
}

const MT_TZ = "America/Denver";

/**
 * Format a DATE (YYYY-MM-DD) or TIMESTAMPTZ string for display in Mountain Time.
 * For DATE inputs, appends T00:00:00 to prevent UTC shift.
 */
export function formatDate(
  dateString: string,
  options?: Intl.DateTimeFormatOptions
): string {
  // DATE strings are 10 chars (YYYY-MM-DD); TIMESTAMPTZ are longer
  const isDateOnly = dateString.length === 10;
  const d = isDateOnly
    ? new Date(dateString + "T00:00:00")
    : new Date(dateString);
  return d.toLocaleDateString("en-US", {
    timeZone: isDateOnly ? undefined : MT_TZ,
    ...options,
  });
}

/**
 * Format a DATE (YYYY-MM-DD) as "May 7th" or "December 6th" — for emails.
 */
export function formatDateFriendly(dateString: string): string {
  const d = new Date(dateString + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${month} ${day}${suffix}`;
}

/**
 * Format a TIMESTAMPTZ string for display in Mountain Time, including time.
 */
export function formatTimestamp(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", { timeZone: MT_TZ });
}

/**
 * Compact date + time for table rows. "May 11, 4:32 PM" — no seconds.
 */
export function formatDateTimeShort(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    timeZone: MT_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Return today's date as YYYY-MM-DD in Mountain Time.
 */
export function getTodayMT(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

/**
 * Compute the first Thursday of a given month.
 * Returns YYYY-MM-DD string.
 */
export function firstThursdayOf(year: number, month: number): string {
  // month is 1-indexed
  const d = new Date(year, month - 1, 1); // local date, day 1
  const dow = d.getDay(); // 0=Sun..6=Sat, Thu=4
  const offset = (4 - dow + 7) % 7;
  const day = 1 + offset;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Format a dinner date as short "May 7" — for inline CTA text.
 */
export function formatDinnerShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${month} ${d.getDate()}`;
}

/**
 * Format a dinner date for display: "May 7th, 2026" style.
 */
export function formatDinnerDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  const suffix =
    day >= 11 && day <= 13
      ? "th"
      : [null, "st", "nd", "rd"][day % 10] ?? "th";
  return `${month} ${day}${suffix}, ${year}`;
}

/**
 * Format a ticket display name: append "+N" for quantity > 1.
 */
export function formatTicketName(
  memberName: string,
  quantity: number
): string {
  if (quantity > 1) return `${memberName} +${quantity - 1}`;
  return memberName;
}

/**
 * Convert a TIMESTAMPTZ string to a YYYY-MM-DD date in Mountain Time.
 */
export function toDateMT(timestamptz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamptz));
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

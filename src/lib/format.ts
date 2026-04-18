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
 * Format a TIMESTAMPTZ string for display in Mountain Time, including time.
 */
export function formatTimestamp(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", { timeZone: MT_TZ });
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

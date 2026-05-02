import { formatDate } from "@/lib/format";

// Fields hidden from the changed-fields list when diffing audit UPDATEs.
// These are trigger-managed and add noise.
export const AUDIT_NOISE_FIELDS = new Set([
  "updated_at",
  "intro_updated_at",
  "ask_updated_at",
  "marketing_opted_out_at",
]);

// Field-label friendly names for changed-field display.
const FIELD_LABELS: Record<string, string> = {
  first_name: "first name",
  last_name: "last name",
  company_name: "company",
  company_website: "website",
  linkedin_profile: "LinkedIn",
  current_intro: "intro",
  current_ask: "ask",
  current_give: "give",
  contact_preference: "contact preference",
  attendee_stagetypes: "role",
  marketing_opted_in: "marketing opt-in",
  is_team: "team status",
  kicked_out: "kicked out",
  has_community_access: "community access",
  profile_pic_url: "profile pic",
  email: "email",
  is_primary: "primary email",
  email_status: "email status",
  status: "status",
  fulfillment_status: "fulfillment status",
  amount_paid: "amount",
  quantity: "quantity",
  ticket_type: "ticket type",
  payment_source: "payment source",
  date: "date",
  venue: "venue",
  address: "address",
  title: "title",
  description: "description",
  guests_allowed: "guests allowed",
  morning_of_sent_at: "morning-of sent",
  rejection_reason: "rejection reason",
  redeemed_ticket_id: "redeemed ticket",
};

export function labelFor(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

export function changedFields(
  old_row: Record<string, unknown> | null,
  new_row: Record<string, unknown> | null
): string[] {
  if (!old_row || !new_row) return [];
  const keys = new Set([...Object.keys(old_row), ...Object.keys(new_row)]);
  const diff: string[] = [];
  for (const k of keys) {
    if (AUDIT_NOISE_FIELDS.has(k)) continue;
    const a = old_row[k];
    const b = new_row[k];
    if (!shallowEqual(a, b)) diff.push(k);
  }
  return diff;
}

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => shallowEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

export function describeChangedFields(fields: string[]): string {
  const visible = fields.filter((f) => !AUDIT_NOISE_FIELDS.has(f));
  if (visible.length === 0) return "(no visible changes)";
  if (visible.length <= 5) {
    return visible.map(labelFor).join(", ");
  }
  return `${visible.length} fields`;
}

export function formatDinnerLabel(dateStr: string): string {
  return formatDate(dateStr, { month: "short", day: "numeric", year: "numeric" });
}

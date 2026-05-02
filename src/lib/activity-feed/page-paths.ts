const PAGE_LABELS: Record<string, string> = {
  "/": "Home",
  "/about": "About",
  "/faq": "FAQ",
  "/team": "Team",
  "/apply": "Apply",
  "/portal": "Portal Home",
  "/portal/profile": "Profile",
  "/portal/recap": "Recap",
  "/portal/tickets": "Tickets",
  "/portal/community": "Community",
  "/admin": "Admin",
  "/admin/dashboard": "Dashboard",
  "/admin/operations": "Operations",
  "/admin/members": "Members",
  "/admin/dinners": "Dinners",
  "/admin/applications": "Applications",
  "/admin/tickets": "Tickets",
  "/admin/emails": "Emails",
  "/admin/emails/templates": "Email Templates",
  "/admin/emails/approval": "Approval Email",
  "/admin/emails/rejection": "Rejection Email",
  "/admin/emails/re-application": "Re-application Email",
  "/admin/emails/fulfillment": "Fulfillment Email",
  "/admin/emails/morning-of": "Morning-of Email",
};

export function subjectLabelForPagePath(
  path: string,
  nameLookup: Map<string, string>,
  dinnerLookup: Map<string, string>,
  applicationLookup: Map<string, string>
): string {
  const staticLabel = PAGE_LABELS[path];
  if (staticLabel) return staticLabel;

  const memberMatch = path.match(
    /\/(?:portal|admin)\/members\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (memberMatch) {
    return `Member: ${nameLookup.get(memberMatch[1]) ?? "(deleted member)"}`;
  }

  const dinnerMatch = path.match(
    /\/admin\/dinners\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (dinnerMatch) {
    const label = dinnerLookup.get(dinnerMatch[1]);
    return `Dinner: ${label ?? "(deleted dinner)"}`;
  }

  const appMatch = path.match(
    /\/admin\/applications\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (appMatch) {
    return `Application: ${applicationLookup.get(appMatch[1]) ?? "(deleted application)"}`;
  }

  return path.replace(/^\//, "") || "Home";
}

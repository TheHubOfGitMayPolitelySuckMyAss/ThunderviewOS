export const EMAIL_FROM = "Thunderview Team <team@thunderviewceodinners.com>";

/**
 * Wraps plain-text email body (with [variable] substitutions already applied)
 * in a branded HTML shell matching the Thunderview design system.
 *
 * - Resend-safe: all CSS inline, table-based layout, no external stylesheets
 * - Outlook-compatible: table structure, no CSS variables
 * - Cream background (#FBF7F0), 600px max-width, clay-500 top border
 * - Fraunces for headings (with Georgia/serif fallback)
 * - Inter for body (with system sans fallback)
 *
 * Line breaks in the body text are converted to <br> tags.
 * The shell includes: clay top-border accent, "Thunderview" wordmark,
 * body content area, and a warm footer.
 */
export function bodyToHtml(body: string, appendHtml?: string): string {
  const rendered = body.replace(/\n/g, "<br>");
  const extra = appendHtml ? `\n${appendHtml}` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Thunderview CEO Dinners</title>
</head>
<body style="margin:0;padding:0;background-color:#EDE3D1;font-family:Inter,-apple-system,BlinkMacSystemFont,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EDE3D1;">
<tr><td align="center" style="padding:32px 16px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FBF7F0;border-radius:10px;overflow:hidden;box-shadow:0 12px 30px rgba(75,54,33,0.12),0 2px 6px rgba(75,54,33,0.06);">

<!-- Clay top border -->
<tr><td style="height:4px;background-color:#9A7A5E;font-size:0;line-height:0;">&nbsp;</td></tr>

<!-- Logo -->
<tr><td style="padding:28px 36px 0;">
<div style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-weight:500;font-size:22px;letter-spacing:-0.01em;color:#2B241C;">Thunderview</div>
</td></tr>

<!-- Body -->
<tr><td style="padding:24px 36px 28px;font-size:15px;line-height:1.6;color:#2B241C;">
${rendered}${extra}
</td></tr>

<!-- Footer -->
<tr><td style="padding:22px 36px;border-top:1px solid #EDE3D1;background-color:#F5EEE1;font-size:12px;color:#75695B;line-height:1.55;text-align:center;">
Thunderview CEO Dinners &middot; Denver, CO
</td></tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

/**
 * Generates an inline-styled CTA button for use in email template body text.
 * Use in admin template bodies like: paste this HTML string where you want
 * the button to appear.
 *
 * This is a helper for the dev preview — actual template bodies store
 * raw HTML including button markup.
 */
export function emailCtaButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background-color:#9A7A5E;color:#FBF7F0 !important;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px;margin:8px 0 6px;">${label}</a>`;
}

/**
 * Generates an inline-styled signature line for email templates.
 */
export function emailSignature(): string {
  return `<div style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-style:italic;font-size:18px;color:#4A3F34;margin-top:22px;">\u2014 Eric</div>`;
}

/**
 * Generates an inline-styled details table (key-value rows) for
 * fulfillment and morning-of emails.
 */
export function emailDetailsTable(rows: { label: string; value: string }[]): string {
  const rowHtml = rows
    .map(
      (r, i) =>
        `<tr><td style="padding:6px 0;${i < rows.length - 1 ? "border-bottom:1px dashed #E2D7C1;" : ""}font-size:14px;color:#75695B;">${r.label}</td><td style="padding:6px 0;${i < rows.length - 1 ? "border-bottom:1px dashed #E2D7C1;" : ""}font-size:14px;color:#2B241C;font-weight:500;text-align:right;">${r.value}</td></tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5EEE1;border:1px solid #EDE3D1;border-radius:10px;padding:18px 22px;margin:18px 0;"><tbody>${rowHtml}</tbody></table>`;
}

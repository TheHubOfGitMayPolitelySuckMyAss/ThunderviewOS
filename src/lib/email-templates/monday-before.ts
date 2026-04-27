/**
 * Monday Before email renderer.
 * Outputs a complete HTML email document matching the Thunderview design system:
 * cream background, Fraunces headings, Inter body, 600px max-width, table-based layout.
 */

const CAN_SPAM_ADDRESS = "Thunderview CEO Dinners / 2462 S Acoma St / Denver, CO 80223 / USA";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://thunderview-os.vercel.app").trim();

interface MondayBeforeEmailProps {
  subject: string;
  preheader: string;
  headline: string;
  customText: string;
  partnershipBoilerplate: string;
  signoffName: string;
  dinner: { date: string; venue: string; address: string };
  images: { groupNumber: number; publicUrl: string; displayOrder: number }[];
  recipientFirstName: string;
  unsubscribeUrl: string;
}

function formatDinnerDate(dateString: string): string {
  const d = new Date(dateString + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${month} ${day}${suffix}, ${year}`;
}

function renderImages(images: MondayBeforeEmailProps["images"], groupNumber: number): string {
  const groupImages = images
    .filter((img) => img.groupNumber === groupNumber)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (groupImages.length === 0) return "";

  return groupImages
    .map(
      (img) =>
        `<tr><td style="padding:0 0 12px;">
          <img src="${img.publicUrl}" alt="" width="528" style="display:block;width:100%;max-width:528px;height:auto;border-radius:8px;" />
        </td></tr>`
    )
    .join("");
}

function inlineLinks(html: string): string {
  // Add inline clay link color to bare <a> tags (no existing style attr)
  return html.replace(/<a(?![^>]*style=)([^>]*>)/g, '<a style="color:#9A7A5E;"$1');
}

export function renderMondayBeforeEmail(props: MondayBeforeEmailProps): string {
  const {
    preheader,
    headline,
    customText,
    partnershipBoilerplate,
    signoffName,
    dinner,
    images,
    recipientFirstName,
    unsubscribeUrl,
  } = props;

  const dinnerDateFormatted = formatDinnerDate(dinner.date);
  const group1Images = renderImages(images, 1);
  const group5Images = renderImages(images, 5);

  // Process rich text content — already HTML from Tiptap
  const customTextRendered = inlineLinks(customText);
  const partnershipRendered = inlineLinks(partnershipBoilerplate);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Thunderview CEO Dinners</title>
<!--[if !mso]><!-->
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--<![endif]-->
${preheader ? `<span style="display:none;font-size:1px;color:#FBF7F0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>` : ""}
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

<!-- Section 1: Image group 1 -->
${group1Images ? `<tr><td style="padding:24px 36px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${group1Images}
</table>
</td></tr>` : ""}

<!-- Section 2: Headline -->
<tr><td style="padding:24px 36px 0;">
<h1 style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-weight:600;font-size:28px;line-height:1.3;color:#2B241C;margin:0;">${headline}</h1>
</td></tr>

<!-- Section 3: Custom text (greeting + body) -->
<tr><td style="padding:16px 36px 0;font-size:15px;line-height:1.6;color:#2B241C;">
<p style="margin:0 0 12px;">Hi ${recipientFirstName},</p>
${customTextRendered}
</td></tr>

<!-- Section 4: Buy a Ticket CTA + dinner details -->
<tr><td style="padding:24px 36px 0;text-align:center;">
<a href="${SITE_URL}/portal/tickets" style="display:inline-block;background-color:#9A7A5E;color:#FBF7F0 !important;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">Buy A Ticket</a>
<p style="margin:16px 0 0;font-size:14px;color:#75695B;line-height:1.5;">${dinnerDateFormatted} from 6p to 9p @ ${dinner.venue} // ${dinner.address}</p>
</td></tr>

<!-- Section 5: Image group 2 -->
${group5Images ? `<tr><td style="padding:24px 36px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${group5Images}
</table>
</td></tr>` : ""}

<!-- Section 6: Partnership boilerplate -->
${partnershipRendered ? `<tr><td style="padding:24px 36px 0;font-size:14px;line-height:1.6;color:#75695B;">
${partnershipRendered}
</td></tr>` : ""}

<!-- Sign-off -->
<tr><td style="padding:24px 36px 0;font-size:15px;color:#2B241C;">
<div style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-style:italic;font-size:18px;color:#4A3F34;">${signoffName}!</div>
</td></tr>

<!-- Footer: CAN-SPAM -->
<tr><td style="padding:28px 36px 22px;border-top:1px solid #EDE3D1;background-color:#F5EEE1;font-size:11px;color:#A09688;line-height:1.55;text-align:center;margin-top:24px;">
${CAN_SPAM_ADDRESS}<br>
<a href="${unsubscribeUrl}" style="color:#A09688;text-decoration:underline;">Unsubscribe from marketing emails</a>
</td></tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

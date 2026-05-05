/**
 * One Off Blast email renderer.
 * Bare-bones marketing broadcast: greeting + custom body + CAN-SPAM footer.
 * No images, no CTA, no dinner block.
 */

const CAN_SPAM_ADDRESS = "Thunderview CEO Dinners / 2462 S Acoma St / Denver, CO 80223 / USA";

interface OneOffBlastEmailProps {
  bodyHtml: string;
  recipientFirstName: string;
  unsubscribeUrl: string;
}

function inlineLinks(html: string): string {
  return html.replace(/<a(?![^>]*style=)([^>]*>)/g, '<a style="color:#9A7A5E;"$1');
}

export function renderOneOffBlastEmail(props: OneOffBlastEmailProps): string {
  const { bodyHtml, recipientFirstName, unsubscribeUrl } = props;
  const bodyRendered = inlineLinks(bodyHtml);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Thunderview CEO Dinners</title>
<!--[if !mso]><!-->
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--<![endif]-->

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

<!-- Body: greeting + custom body -->
<tr><td style="padding:24px 36px 0;font-size:15px;line-height:1.6;color:#2B241C;">
<p style="margin:0 0 12px;">Hi ${recipientFirstName},</p>
${bodyRendered}
</td></tr>

<!-- Spacer before footer -->
<tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>

<!-- Footer: CAN-SPAM -->
<tr><td style="padding:28px 36px 22px;border-top:1px solid #EDE3D1;background-color:#F5EEE1;font-size:11px;color:#A09688;line-height:1.55;text-align:center;">
${CAN_SPAM_ADDRESS}<br>
<a href="${unsubscribeUrl}" style="color:#A09688;text-decoration:underline;">Unsubscribe from marketing emails</a>
</td></tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

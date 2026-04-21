export const EMAIL_FROM = "team@thunderviewceodinners.com";

export function bodyToHtml(body: string): string {
  return body.replace(/\n/g, "<br>");
}

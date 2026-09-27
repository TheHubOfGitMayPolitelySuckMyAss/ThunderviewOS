import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRawMessage,
  formatFromHeader,
  listUnsubscribeHeaders,
  resolveFromName,
  SENDER_FALLBACK_NAME,
} from "../send.ts";

function decode(raw: string): string {
  return Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function headerBlock(raw: string): string {
  return decode(raw).split("\r\n\r\n")[0];
}

test("resolveFromName: send-as name wins, empty/whitespace falls back", () => {
  assert.equal(resolveFromName("Eric M", SENDER_FALLBACK_NAME), "Eric M");
  assert.equal(resolveFromName(null, SENDER_FALLBACK_NAME), "Eric Marcoullier");
  assert.equal(resolveFromName("", SENDER_FALLBACK_NAME), "Eric Marcoullier");
  assert.equal(resolveFromName("   ", SENDER_FALLBACK_NAME), "Eric Marcoullier");
  assert.equal(resolveFromName(undefined, ""), null);
});

test("formatFromHeader: plain, quoted specials, RFC 2047 non-ASCII, bare", () => {
  assert.equal(formatFromHeader("a@b.com", "Eric Marcoullier"), "Eric Marcoullier <a@b.com>");
  assert.equal(formatFromHeader("a@b.com", "Marcoullier, Eric"), '"Marcoullier, Eric" <a@b.com>');
  assert.equal(formatFromHeader("a@b.com", "Eric M. \"E\""), '"Eric M. \\"E\\"" <a@b.com>');
  assert.equal(
    formatFromHeader("a@b.com", "Éric"),
    `=?UTF-8?B?${Buffer.from("Éric", "utf8").toString("base64")}?= <a@b.com>`
  );
  assert.equal(formatFromHeader("a@b.com", null), "a@b.com");
  assert.equal(formatFromHeader("a@b.com", "  "), "a@b.com");
});

test("buildRawMessage: From carries the display name", () => {
  const raw = buildRawMessage({
    to: "x@test.invalid",
    fromEmail: "eric@marcoullier.com",
    fromName: SENDER_FALLBACK_NAME,
    subject: "Hi",
    bodyHtml: "<p>Hello</p>",
    boundary: "B",
  });
  assert.match(headerBlock(raw), /^From: Eric Marcoullier <eric@marcoullier\.com>\r$/m);
});

test("buildRawMessage: List-Unsubscribe headers only when a URL is given", () => {
  const url = "https://thunderviewceodinners.com/api/unsubscribe?token=abc.def";
  const withUnsub = headerBlock(
    buildRawMessage({
      to: "x@test.invalid",
      fromEmail: "eric@marcoullier.com",
      subject: "Hi",
      bodyHtml: "<p>Hello</p>",
      boundary: "B",
      listUnsubscribeUrl: url,
    })
  );
  assert.ok(withUnsub.includes(`\r\nList-Unsubscribe: <${url}>\r\n`));
  assert.ok(withUnsub.includes("\r\nList-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n"));

  const without = headerBlock(
    buildRawMessage({
      to: "x@test.invalid",
      fromEmail: "eric@marcoullier.com",
      subject: "Hi",
      bodyHtml: "<p>Hello</p>",
      boundary: "B",
    })
  );
  assert.ok(!without.includes("List-Unsubscribe"));
});

test("listUnsubscribeHeaders: rejects non-https and header-breaking URLs", () => {
  assert.throws(() => listUnsubscribeHeaders("http://x.com/u"));
  assert.throws(() => listUnsubscribeHeaders("https://x.com/u>\r\nBcc: evil@x.com"));
  assert.throws(() => listUnsubscribeHeaders("https://x.com/a b"));
  assert.equal(listUnsubscribeHeaders("https://x.com/u?t=1").length, 2);
});

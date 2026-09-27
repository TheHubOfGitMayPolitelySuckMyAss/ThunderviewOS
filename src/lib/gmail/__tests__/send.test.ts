import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRawMessage,
  formatFromHeader,
  listUnsubscribeHeaders,
  resolveFromName,
  resolveSenderNameWith,
} from "../send.ts";

function decode(raw: string): string {
  return Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function headerBlock(raw: string): string {
  return decode(raw).split("\r\n\r\n")[0];
}

test("resolveFromName: send-as name wins, else owner's name, else null", () => {
  const owner = { first_name: "Pat", last_name: "Lee" };
  assert.equal(resolveFromName("Eric M", owner), "Eric M");
  assert.equal(resolveFromName("   ", owner), "Pat Lee");
  assert.equal(resolveFromName(null, { first_name: "Pat", last_name: "" }), "Pat");
  assert.equal(resolveFromName("", null), null);
  assert.equal(resolveFromName(null, { first_name: " ", last_name: null }), null);
});

function ladder(owners: Record<string, { first_name: string; last_name: string }>) {
  const calls = { lookups: [] as string[], warnings: 0 };
  const lookup = async (email: string) => {
    calls.lookups.push(email);
    return owners[email] ?? null;
  };
  const onMissing = async () => {
    calls.warnings += 1;
  };
  return { calls, lookup, onMissing };
}

const MEMBERS = {
  "eric@marcoullier.com": { first_name: "Eric", last_name: "Marcoullier" },
  "pat@team.test": { first_name: "Pat", last_name: "Lee" },
};

test("sender ladder: non-empty send-as displayName is used, no lookup", async () => {
  const { calls, lookup, onMissing } = ladder(MEMBERS);
  const name = await resolveSenderNameWith(
    { email: "pat@team.test", displayName: "Pat From Gmail" },
    lookup,
    onMissing
  );
  assert.equal(name, "Pat From Gmail");
  assert.deepEqual(calls.lookups, []);
  assert.equal(calls.warnings, 0);
});

test("sender ladder: empty send-as + member match → that member's name", async () => {
  const { calls, lookup, onMissing } = ladder(MEMBERS);
  const name = await resolveSenderNameWith(
    { email: "pat@team.test", displayName: "  " },
    lookup,
    onMissing
  );
  assert.equal(name, "Pat Lee");
  assert.deepEqual(calls.lookups, ["pat@team.test"]);
  assert.equal(calls.warnings, 0);
});

test("sender ladder: empty send-as + no member → bare address + one warning", async () => {
  const { calls, lookup, onMissing } = ladder(MEMBERS);
  const name = await resolveSenderNameWith(
    { email: "stranger@elsewhere.test", displayName: null },
    lookup,
    onMissing
  );
  assert.equal(name, null);
  assert.equal(calls.warnings, 1);
  assert.equal(formatFromHeader("stranger@elsewhere.test", name), "stranger@elsewhere.test");
});

test("sender ladder: never puts Eric's name on a non-Eric address", async () => {
  for (const email of ["pat@team.test", "stranger@elsewhere.test"]) {
    const { lookup, onMissing } = ladder(MEMBERS);
    const name = await resolveSenderNameWith({ email, displayName: null }, lookup, onMissing);
    const from = formatFromHeader(email, name);
    assert.ok(!/Eric|Marcoullier/.test(from), `${email} → ${from}`);
  }
  // Eric's own address resolves to Eric via the member lookup, not a constant.
  const { lookup, onMissing } = ladder(MEMBERS);
  assert.equal(
    await resolveSenderNameWith({ email: "eric@marcoullier.com", displayName: "" }, lookup, onMissing),
    "Eric Marcoullier"
  );
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
    fromName: "Eric Marcoullier",
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

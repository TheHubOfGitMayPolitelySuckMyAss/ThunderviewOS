import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUnsubscribeUrl,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../unsubscribe.ts";

const MEMBER = "11111111-2222-3333-4444-555555555555";

test("buildUnsubscribeUrl: absolute https URL on the shared endpoint, token verifies", () => {
  const url = new URL(buildUnsubscribeUrl(MEMBER, "https://thunderviewceodinners.com/\n"));
  assert.equal(url.origin, "https://thunderviewceodinners.com");
  assert.equal(url.pathname, "/api/unsubscribe");
  const token = url.searchParams.get("token")!;
  assert.equal(token, generateUnsubscribeToken(MEMBER));
  assert.equal(verifyUnsubscribeToken(token), MEMBER);
});

test("verifyUnsubscribeToken: rejects a forged or tampered token", () => {
  const token = generateUnsubscribeToken(MEMBER);
  const other = "99999999-2222-3333-4444-555555555555";
  assert.equal(verifyUnsubscribeToken(`${other}.${token.split(".")[1]}`), null);
  assert.equal(verifyUnsubscribeToken(`${MEMBER}.deadbeef`), null);
  assert.equal(verifyUnsubscribeToken(MEMBER), null);
});

/**
 * Resend webhook handler end-to-end probe.
 *
 * Exercises every branch of src/app/api/webhooks/resend/route.ts with realistic
 * Resend payload shapes against the production database, with full cleanup.
 *
 *   npx tsx --env-file=.env.local tmp/resend-webhook-probe.ts
 *
 * Approach: signs synthetic payloads with HMAC-SHA256 (svix wire format) using
 * an override RESEND_WEBHOOK_SECRET, then invokes the route handler's POST
 * function directly with a constructed Request. STREAK_API_KEY is overridden
 * to an invalid value so safePushMember fails fast and logs error.caught —
 * doubles as the "push fired" assertion for hard-bounce / complaint paths.
 *
 * Test data uses first_name='Probe' company_name='Probe Test' and emails at
 * @thunderview-probe.invalid (RFC 2606 reserved TLD, never resolves).
 */

const TEST_WEBHOOK_SECRET =
  "whsec_" + Buffer.from("00112233445566778899aabbccddeeff", "hex").toString("base64");
process.env.RESEND_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
process.env.STREAK_API_KEY = "probe-invalid-key-do-not-use";

import crypto from "node:crypto";
import { POST } from "../src/app/api/webhooks/resend/route";
import { createAdminClient } from "../src/lib/supabase/admin";

const PROBE_DOMAIN = "thunderview-probe.invalid";
const PROBE_COMPANY = "Probe Test";
const FROM_THUNDERVIEW = "Thunderview Team <team@thunderviewceodinners.com>";
const FROM_THUNDERVIEW_BARE = "team@thunderviewceodinners.com";
const FROM_SHOWHARDER = "Show Harder <notifications@showharder.com>";

interface TestResult {
  name: string;
  outcome: "pass" | "fail" | "skipped";
  detail?: string;
}
const results: TestResult[] = [];
function record(name: string, outcome: TestResult["outcome"], detail?: string) {
  results.push({ name, outcome, detail });
  const tag = outcome === "pass" ? "✓ PASS" : outcome === "fail" ? "✗ FAIL" : "- SKIP";
  console.log(`${tag}  ${name}${detail ? "  — " + detail : ""}`);
}

function signSvix(body: string) {
  const id = "msg_" + crypto.randomUUID();
  const ts = Math.floor(Date.now() / 1000).toString();
  const secretBytes = Buffer.from(
    TEST_WEBHOOK_SECRET.replace(/^whsec_/, ""),
    "base64"
  );
  const sig = crypto
    .createHmac("sha256", secretBytes)
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": ts,
    "svix-signature": `v1,${sig}`,
    "content-type": "application/json",
  };
}

async function fireWebhook(payload: object): Promise<Response> {
  const body = JSON.stringify(payload);
  const req = new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    headers: signSvix(body),
    body,
  });
  return await POST(req);
}

interface BounceOpts {
  resendEmailId: string;
  to: string;
  from: string;
  bounceType: "Permanent" | "Transient" | "Undetermined" | string;
  subject?: string;
}
function bouncePayload(o: BounceOpts) {
  return {
    type: "email.bounced",
    created_at: new Date().toISOString(),
    data: {
      to: [o.to],
      from: o.from,
      subject: o.subject ?? `Probe ${o.resendEmailId}`,
      email_id: o.resendEmailId,
      created_at: new Date().toISOString(),
      bounce: {
        type: o.bounceType,
        subType: "General",
        message: "probe synthetic",
        diagnosticCode: [null],
      },
      headers: [{ name: "Reply-To", value: "eric@marcoullier.com" }],
    },
  };
}

function complaintPayload(o: { resendEmailId: string; to: string; from: string }) {
  return {
    type: "email.complained",
    created_at: new Date().toISOString(),
    data: {
      to: [o.to],
      from: o.from,
      subject: `Probe ${o.resendEmailId}`,
      email_id: o.resendEmailId,
      created_at: new Date().toISOString(),
    },
  };
}

function failedPayload(o: { resendEmailId: string; to: string; from: string }) {
  return {
    type: "email.failed",
    created_at: new Date().toISOString(),
    data: {
      to: [o.to],
      from: o.from,
      subject: `Probe ${o.resendEmailId}`,
      email_id: o.resendEmailId,
      created_at: new Date().toISOString(),
      error: "Probe synthetic failure",
    },
  };
}

interface ProbeMemberOpts {
  tag: string;
  emails: { addr: string; isPrimary: boolean }[];
  marketingOptedIn?: boolean;
}
async function setupProbeMember(opts: ProbeMemberOpts): Promise<string> {
  const admin = createAdminClient();
  const { data: member, error: mErr } = await admin
    .from("members")
    .insert({
      first_name: "Probe",
      last_name: opts.tag,
      company_name: PROBE_COMPANY,
      attendee_stagetypes: ["Active CEO (Bootstrapping or VC-Backed)"],
      has_community_access: true,
      kicked_out: false,
      marketing_opted_in: opts.marketingOptedIn ?? true,
    })
    .select("id")
    .single();
  if (mErr || !member) {
    throw new Error(`probe member insert failed (${opts.tag}): ${mErr?.message}`);
  }
  for (const e of opts.emails) {
    const { error: eErr } = await admin.from("member_emails").insert({
      member_id: member.id,
      email: e.addr,
      is_primary: e.isPrimary,
      email_status: "active",
      source: "manual",
    });
    if (eErr) {
      throw new Error(`probe email insert failed (${e.addr}): ${eErr.message}`);
    }
  }
  return member.id;
}

async function teardownAll() {
  const admin = createAdminClient();

  // Find probe members by tag.
  const { data: members } = await admin
    .from("members")
    .select("id")
    .eq("first_name", "Probe")
    .eq("company_name", PROBE_COMPANY);
  const memberIds = (members ?? []).map((m) => m.id);

  // Delete email_events scoped to probe domain or probe members.
  await admin.from("email_events").delete().like("recipient_email", `%@${PROBE_DOMAIN}`);
  if (memberIds.length > 0) {
    await admin.from("email_events").delete().in("member_id", memberIds);
  }

  // Scrub system_events that reference probe members.
  if (memberIds.length > 0) {
    await admin.from("system_events").update({ subject_member_id: null }).in("subject_member_id", memberIds);
    await admin.from("system_events").update({ actor_id: null }).in("actor_id", memberIds);
    // Delete error.caught events from safePushMember whose metadata names a probe member.
    const { data: errs } = await admin
      .from("system_events")
      .select("id, metadata")
      .eq("event_type", "error.caught");
    const probeErrIds = (errs ?? [])
      .filter((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (e as any).metadata as Record<string, unknown> | null;
        const mid = md && typeof md.member_id === "string" ? (md.member_id as string) : null;
        return mid && memberIds.includes(mid);
      })
      .map((e) => (e as { id: string }).id);
    if (probeErrIds.length > 0) {
      await admin.from("system_events").delete().in("id", probeErrIds);
    }
  }

  // Delete member_emails (unique-by-email; probe domain catches all).
  await admin.from("member_emails").delete().like("email", `%@${PROBE_DOMAIN}`);
  if (memberIds.length > 0) {
    await admin.from("member_emails").delete().in("member_id", memberIds);
  }

  // Delete probe members.
  if (memberIds.length > 0) {
    await admin.from("members").delete().in("id", memberIds);
  }
}

async function getRow<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  const { data } = await p;
  return data;
}

async function main() {
  console.log("=== Resend webhook probe ===");
  console.log("Pre-cleaning any leftover probe rows…");
  await teardownAll();
  const admin = createAdminClient();

  try {
    // ----- T1: non-Thunderview drop -----
    {
      const eid = `probe-t1-${crypto.randomUUID()}`;
      const res = await fireWebhook(
        bouncePayload({
          resendEmailId: eid,
          to: "someone@example.com",
          from: FROM_SHOWHARDER,
          bounceType: "Permanent",
        })
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = (await res.json()) as any;
      const { data: rows } = await admin
        .from("email_events")
        .select("id")
        .eq("resend_email_id", eid);
      const ok = res.status === 200 && body?.skipped === "non_thunderview_sender" && (rows?.length ?? 0) === 0;
      record("T1: non-Thunderview drop", ok ? "pass" : "fail", `status=${res.status} skipped=${body?.skipped} rows=${rows?.length}`);
    }

    // ----- T2: Thunderview accepted (no member match) -----
    {
      const eid = `probe-t2-${crypto.randomUUID()}`;
      await fireWebhook(
        bouncePayload({
          resendEmailId: eid,
          to: `probe-t2@${PROBE_DOMAIN}`,
          from: FROM_THUNDERVIEW,
          bounceType: "Permanent",
        })
      );
      const { data: rows } = await admin
        .from("email_events")
        .select("id, recipient_email, member_id")
        .eq("resend_email_id", eid);
      const row = rows?.[0];
      const ok = !!row && row.recipient_email === `probe-t2@${PROBE_DOMAIN}` && row.member_id === null;
      record("T2: Thunderview accepted (no match)", ok ? "pass" : "fail", row ? `recipient=${row.recipient_email} member=${row.member_id}` : "no row");
    }

    // ----- T3: Bracket-format recipient resolves to member -----
    {
      const email = `probe-t3@${PROBE_DOMAIN}`;
      const memberId = await setupProbeMember({ tag: "T3", emails: [{ addr: email, isPrimary: true }] });
      const eid = `probe-t3-${crypto.randomUUID()}`;
      await fireWebhook(
        bouncePayload({
          resendEmailId: eid,
          to: `Probe T3 <${email}>`,
          from: FROM_THUNDERVIEW,
          bounceType: "Permanent",
        })
      );
      const ev = await getRow(admin.from("email_events").select("recipient_email, member_id").eq("resend_email_id", eid).single());
      const me = await getRow(admin.from("member_emails").select("email_status").eq("email", email).single());
      const ok =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ev as any)?.member_id === memberId && (ev as any)?.recipient_email === email && (me as any)?.email_status === "bounced";
      record("T3: Bracket recipient resolves", ok ? "pass" : "fail", JSON.stringify({ ev, me }));
    }

    // ----- T4: Bare-format recipient still works -----
    {
      const email = `probe-t4@${PROBE_DOMAIN}`;
      const memberId = await setupProbeMember({ tag: "T4", emails: [{ addr: email, isPrimary: true }] });
      const eid = `probe-t4-${crypto.randomUUID()}`;
      await fireWebhook(
        bouncePayload({
          resendEmailId: eid,
          to: email,
          from: FROM_THUNDERVIEW,
          bounceType: "Permanent",
        })
      );
      const ev = await getRow(admin.from("email_events").select("recipient_email, member_id").eq("resend_email_id", eid).single());
      const me = await getRow(admin.from("member_emails").select("email_status").eq("email", email).single());
      const ok =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ev as any)?.member_id === memberId && (ev as any)?.recipient_email === email && (me as any)?.email_status === "bounced";
      record("T4: Bare recipient still works", ok ? "pass" : "fail", JSON.stringify({ ev, me }));
    }

    // ----- T5: Hard bounce + promote secondary + push -----
    {
      const primary = `probe-t5-primary@${PROBE_DOMAIN}`;
      const secondary = `probe-t5-secondary@${PROBE_DOMAIN}`;
      const memberId = await setupProbeMember({
        tag: "T5",
        emails: [
          { addr: primary, isPrimary: true },
          { addr: secondary, isPrimary: false },
        ],
      });
      const startedAt = new Date().toISOString();
      const eid = `probe-t5-${crypto.randomUUID()}`;
      await fireWebhook(
        bouncePayload({
          resendEmailId: eid,
          to: primary,
          from: FROM_THUNDERVIEW,
          bounceType: "Permanent",
        })
      );
      const { data: emails } = await admin
        .from("member_emails")
        .select("email, is_primary, email_status")
        .eq("member_id", memberId);
      const pRow = emails?.find((e) => e.email === primary);
      const sRow = emails?.find((e) => e.email === secondary);
      const promoted = sRow?.is_primary === true && pRow?.is_primary === false;
      const flipped = pRow?.email_status === "bounced";
      const secondaryActive = sRow?.email_status === "active";
      // Confirm push fired (invalid Streak key → error.caught)
      const { data: errs } = await admin
        .from("system_events")
        .select("id, metadata")
        .eq("event_type", "error.caught")
        .gte("occurred_at", startedAt);
      const pushFired = (errs ?? []).some((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (e as any).metadata as Record<string, unknown> | null;
        return md?.source === "streak_push" && md?.member_id === memberId;
      });
      const ok = promoted && flipped && secondaryActive && pushFired;
      record(
        "T5: Hard bounce + promote secondary + push",
        ok ? "pass" : "fail",
        JSON.stringify({ promoted, flipped, secondaryActive, pushFired })
      );
    }

    // ----- T6: Hard bounce, no eligible secondary -----
    {
      const email = `probe-t6@${PROBE_DOMAIN}`;
      const memberId = await setupProbeMember({ tag: "T6", emails: [{ addr: email, isPrimary: true }] });
      const startedAt = new Date().toISOString();
      const eid = `probe-t6-${crypto.randomUUID()}`;
      await fireWebhook(
        bouncePayload({
          resendEmailId: eid,
          to: email,
          from: FROM_THUNDERVIEW,
          bounceType: "Permanent",
        })
      );
      const { data: emails } = await admin
        .from("member_emails")
        .select("email, is_primary, email_status")
        .eq("member_id", memberId);
      const row = emails?.[0];
      const stillPrimary = row?.is_primary === true;
      const flipped = row?.email_status === "bounced";
      const onlyOne = (emails?.length ?? 0) === 1;
      const { data: errs } = await admin
        .from("system_events")
        .select("metadata")
        .eq("event_type", "error.caught")
        .gte("occurred_at", startedAt);
      const pushFired = (errs ?? []).some((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (e as any).metadata as Record<string, unknown> | null;
        return md?.source === "streak_push" && md?.member_id === memberId;
      });
      const ok = stillPrimary && flipped && onlyOne && pushFired;
      record(
        "T6: Hard bounce, no secondary",
        ok ? "pass" : "fail",
        JSON.stringify({ stillPrimary, flipped, onlyOne, pushFired })
      );
    }

    // ----- T7: Soft bounce records, no act -----
    {
      const email = `probe-t7@${PROBE_DOMAIN}`;
      const memberId = await setupProbeMember({ tag: "T7", emails: [{ addr: email, isPrimary: true }] });
      const startedAt = new Date().toISOString();
      const eid = `probe-t7-${crypto.randomUUID()}`;
      await fireWebhook(
        bouncePayload({
          resendEmailId: eid,
          to: email,
          from: FROM_THUNDERVIEW,
          bounceType: "Transient",
        })
      );
      const ev = await getRow(admin.from("email_events").select("event_type, member_id").eq("resend_email_id", eid).single());
      const me = await getRow(admin.from("member_emails").select("email_status, is_primary").eq("email", email).single());
      const { data: errs } = await admin
        .from("system_events")
        .select("metadata")
        .eq("event_type", "error.caught")
        .gte("occurred_at", startedAt);
      const pushFired = (errs ?? []).some((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (e as any).metadata as Record<string, unknown> | null;
        return md?.source === "streak_push" && md?.member_id === memberId;
      });
      const ok =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        !!ev && (me as any)?.email_status === "active" && (me as any)?.is_primary === true && (ev as any).member_id === memberId && !pushFired;
      record("T7: Soft bounce records, no act", ok ? "pass" : "fail", JSON.stringify({ ev, me, pushFired }));
    }

    // ----- T8: Undetermined defaults to soft -----
    {
      const email = `probe-t8@${PROBE_DOMAIN}`;
      const memberId = await setupProbeMember({ tag: "T8", emails: [{ addr: email, isPrimary: true }] });
      const startedAt = new Date().toISOString();
      const eid = `probe-t8-${crypto.randomUUID()}`;
      await fireWebhook(
        bouncePayload({
          resendEmailId: eid,
          to: email,
          from: FROM_THUNDERVIEW,
          bounceType: "Undetermined",
        })
      );
      const ev = await getRow(admin.from("email_events").select("event_type, member_id").eq("resend_email_id", eid).single());
      const me = await getRow(admin.from("member_emails").select("email_status, is_primary").eq("email", email).single());
      const { data: errs } = await admin
        .from("system_events")
        .select("metadata")
        .eq("event_type", "error.caught")
        .gte("occurred_at", startedAt);
      const pushFired = (errs ?? []).some((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (e as any).metadata as Record<string, unknown> | null;
        return md?.source === "streak_push" && md?.member_id === memberId;
      });
      const ok =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        !!ev && (me as any)?.email_status === "active" && (me as any)?.is_primary === true && !pushFired;
      record("T8: Undetermined = soft", ok ? "pass" : "fail", JSON.stringify({ ev, me, pushFired }));
    }

    // ----- T9: Complaint flow -----
    {
      const email = `probe-t9@${PROBE_DOMAIN}`;
      const memberId = await setupProbeMember({
        tag: "T9",
        emails: [{ addr: email, isPrimary: true }],
        marketingOptedIn: true,
      });
      const startedAt = new Date().toISOString();
      const eid = `probe-t9-${crypto.randomUUID()}`;
      await fireWebhook(
        complaintPayload({
          resendEmailId: eid,
          to: email,
          from: FROM_THUNDERVIEW_BARE,
        })
      );
      const ev = await getRow(admin.from("email_events").select("event_type, member_id").eq("resend_email_id", eid).single());
      const me = await getRow(admin.from("member_emails").select("email_status").eq("email", email).single());
      const mem = await getRow(admin.from("members").select("marketing_opted_in").eq("id", memberId).single());
      const { data: errs } = await admin
        .from("system_events")
        .select("metadata")
        .eq("event_type", "error.caught")
        .gte("occurred_at", startedAt);
      const pushFired = (errs ?? []).some((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (e as any).metadata as Record<string, unknown> | null;
        return md?.source === "streak_push" && md?.member_id === memberId;
      });
      const ok =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ev as any)?.event_type === "complained" &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (me as any)?.email_status === "complained" &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mem as any)?.marketing_opted_in === false &&
        pushFired;
      record("T9: Complaint flow", ok ? "pass" : "fail", JSON.stringify({ ev, me, mem, pushFired }));
    }

    // ----- T10: Failed flow -----
    {
      const email = `probe-t10@${PROBE_DOMAIN}`;
      const memberId = await setupProbeMember({ tag: "T10", emails: [{ addr: email, isPrimary: true }] });
      const startedAt = new Date().toISOString();
      const eid = `probe-t10-${crypto.randomUUID()}`;
      await fireWebhook(
        failedPayload({
          resendEmailId: eid,
          to: email,
          from: FROM_THUNDERVIEW,
        })
      );
      const ev = await getRow(admin.from("email_events").select("event_type, member_id").eq("resend_email_id", eid).single());
      const me = await getRow(admin.from("member_emails").select("email_status").eq("email", email).single());
      const { data: errs } = await admin
        .from("system_events")
        .select("metadata")
        .eq("event_type", "error.caught")
        .gte("occurred_at", startedAt);
      const pushFired = (errs ?? []).some((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (e as any).metadata as Record<string, unknown> | null;
        return md?.source === "streak_push" && md?.member_id === memberId;
      });
      const ok =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ev as any)?.event_type === "failed" &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (me as any)?.email_status === "active" &&
        !pushFired;
      record("T10: Failed flow (no state change)", ok ? "pass" : "fail", JSON.stringify({ ev, me, pushFired }));
    }

    // ----- T11: recipient_email stored bare+lowercase -----
    {
      const email = `probe-t11@${PROBE_DOMAIN}`;
      const memberId = await setupProbeMember({ tag: "T11", emails: [{ addr: email, isPrimary: true }] });
      const eid = `probe-t11-${crypto.randomUUID()}`;
      // Mixed-case + bracket-form payload
      await fireWebhook(
        bouncePayload({
          resendEmailId: eid,
          to: `Probe Eleven <PROBE-T11@${PROBE_DOMAIN.toUpperCase()}>`,
          from: FROM_THUNDERVIEW,
          bounceType: "Transient",
        })
      );
      const ev = await getRow(
        admin.from("email_events").select("recipient_email, member_id").eq("resend_email_id", eid).single()
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stored = (ev as any)?.recipient_email as string | undefined;
      const isLower = stored !== undefined && stored === stored.toLowerCase();
      const noBrackets = stored !== undefined && !stored.includes("<") && !stored.includes(">");
      const matchedMember = stored === email;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memberLinked = (ev as any)?.member_id === memberId;
      const ok = isLower && noBrackets && matchedMember && memberLinked;
      record("T11: recipient_email bare+lowercase", ok ? "pass" : "fail", `stored=${stored}`);
    }
  } finally {
    console.log("\nCleanup…");
    try {
      await teardownAll();
      console.log("Cleanup complete.");
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }

  console.log("\n=== RESULTS ===");
  for (const r of results) {
    const tag = r.outcome === "pass" ? "PASS" : r.outcome === "fail" ? "FAIL" : "SKIP";
    console.log(`${tag.padEnd(5)} ${r.name}`);
  }
  const failed = results.filter((r) => r.outcome === "fail").length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Probe crashed:", err);
  try {
    await teardownAll();
  } catch {}
  process.exit(1);
});

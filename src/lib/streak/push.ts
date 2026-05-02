/**
 * Streak push primitives. Idempotent: same OS state produces the same Streak
 * state. The streak_box_key column on members/applications is the durable
 * pointer — set on first push, used to update in place thereafter.
 *
 * These functions throw on Streak API failure. Callers (Prompt B wiring)
 * decide retry/logging policy. Library is inert until that wiring lands.
 */

import {
  addContactToBox,
  createBox,
  createContact,
  deleteBox,
  setBoxField,
  updateBox,
  updateContact,
} from "@/lib/streak/client";
import { ensureStreakReady } from "@/lib/streak/bootstrap";
import {
  computeStageForApplication,
  computeStageForMember,
  getMemberStreakState,
} from "@/lib/streak/compute-stage";
import { formatName } from "@/lib/format";
import { logSystemEvent } from "@/lib/system-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberPrimaryEmail } from "@/lib/member-lookup";

/**
 * Pick the email to attach as the box's mail-merge contact.
 *
 * Spec (Prompt D): use primary email unless it's bounced AND a non-bounced
 * alternative exists. If every email is bounced, fall back to primary so the
 * box still has a contact (the member just won't actually get merged because
 * they'll land in the Bounced stage).
 *
 * Returns null only when the member has zero email rows — defensive guard;
 * shouldn't happen for any non-fixture member post-Phase 1.
 */
async function chooseContactEmailForMember(
  admin: ReturnType<typeof createAdminClient>,
  memberId: string
): Promise<string | null> {
  const res = await admin
    .from("member_emails")
    .select("email, is_primary, email_status")
    .eq("member_id", memberId);
  if (res.error) {
    throw new Error(
      `chooseContactEmailForMember: query failed: ${res.error.message}`
    );
  }
  const rows = (res.data ?? []) as {
    email: string;
    is_primary: boolean;
    email_status: string;
  }[];
  if (rows.length === 0) return null;
  const primary = rows.find((r) => r.is_primary) ?? null;
  if (!primary) return null;
  if (primary.email_status !== "bounced") return primary.email;
  const nonBounced = rows.find((r) => r.email_status !== "bounced");
  return nonBounced ? nonBounced.email : primary.email;
}

/**
 * Idempotent contact attach: resolve (or create) a contact for the email,
 * patch its name if it differs from what we have on the OS row, and link
 * it to the box. Streak's Contacts API treats getIfExisting=true as
 * server-side dedup, so calling this on every push is cheap.
 */
async function attachContactToBox(args: {
  teamKey: string;
  boxKey: string;
  email: string;
  firstName: string;
  lastName: string;
}): Promise<void> {
  const contact = await createContact(args.teamKey, {
    emailAddress: args.email,
    getIfExisting: true,
  });
  if (!contact?.key) {
    throw new Error(
      `attachContactToBox: createContact returned no key for ${args.email}`
    );
  }

  const desiredFirst = args.firstName || "";
  const desiredLast = args.lastName || "";
  const currentFirst = contact.givenName ?? "";
  const currentLast = contact.familyName ?? "";
  if (currentFirst !== desiredFirst || currentLast !== desiredLast) {
    await updateContact(contact.key, {
      givenName: desiredFirst,
      familyName: desiredLast,
    });
  }

  await addContactToBox(args.boxKey, contact.key);
}

export async function pushMemberToStreak(memberId: string): Promise<void> {
  const admin = createAdminClient("system-internal");

  const memberRes = await admin
    .from("members")
    .select("id, first_name, last_name, company_name, streak_box_key")
    .eq("id", memberId)
    .single();
  if (memberRes.error || !memberRes.data) {
    throw new Error(
      `pushMemberToStreak: member ${memberId} not found: ${memberRes.error?.message ?? "no data"}`
    );
  }
  const member = memberRes.data;

  const state = await getMemberStreakState(memberId);
  const stage = computeStageForMember(state);
  const email = await getMemberPrimaryEmail(admin, memberId);

  const { pipelineKey, teamKey, stageKeys, fieldKeys } =
    await ensureStreakReady();
  const targetStageKey = stageKeys[stage];
  const name = formatName(member.first_name ?? "", member.last_name ?? "");
  const company = member.company_name ?? "";

  let boxKey = member.streak_box_key as string | null;

  if (!boxKey) {
    const created = await createBox(pipelineKey, {
      name,
      stageKey: targetStageKey,
    });
    if (!created?.boxKey) {
      throw new Error(
        `pushMemberToStreak: createBox for member ${memberId} returned no boxKey`
      );
    }
    boxKey = created.boxKey;

    const update = await admin
      .from("members")
      .update({ streak_box_key: boxKey })
      .eq("id", memberId);
    if (update.error) {
      throw new Error(
        `pushMemberToStreak: failed to persist streak_box_key for member ${memberId}: ${update.error.message}`
      );
    }
  } else {
    await updateBox(boxKey, { name, stageKey: targetStageKey });
  }

  // Set all 4 fields unconditionally — simpler than diffing, and Streak
  // accepts the same value as a no-op write. Box email field stays the
  // primary regardless of bounce status — it's the canonical display
  // address even when bounced. The contact step below picks a different
  // email if primary is bounced and an alternative exists.
  await setBoxField(boxKey, fieldKeys.first_name, member.first_name ?? "");
  await setBoxField(boxKey, fieldKeys.last_name, member.last_name ?? "");
  await setBoxField(boxKey, fieldKeys.company, company);
  await setBoxField(boxKey, fieldKeys.email, email);

  // Attach a Contact so mail merges have a recipient. Custom columns alone
  // don't surface in Streak's mail-merge UI.
  const contactEmail = await chooseContactEmailForMember(admin, memberId);
  if (!contactEmail) {
    void logSystemEvent({
      event_type: "streak.contact_skipped",
      metadata: { reason: "no_email", member_id: memberId },
    });
    return;
  }
  await attachContactToBox({
    teamKey,
    boxKey,
    email: contactEmail,
    firstName: member.first_name ?? "",
    lastName: member.last_name ?? "",
  });
}

export async function pushApplicationToStreak(
  applicationId: string
): Promise<void> {
  const admin = createAdminClient("system-internal");

  const appRes = await admin
    .from("applications")
    .select(
      "id, first_name, last_name, email, company_name, status, member_id, streak_box_key"
    )
    .eq("id", applicationId)
    .single();
  if (appRes.error || !appRes.data) {
    throw new Error(
      `pushApplicationToStreak: application ${applicationId} not found: ${appRes.error?.message ?? "no data"}`
    );
  }
  const app = appRes.data;

  const stage = computeStageForApplication({
    status: app.status,
    member_id: app.member_id,
  });
  if (stage === null) {
    throw new Error(
      `pushApplicationToStreak: application ${applicationId} is not in the "applied" state (status=${app.status}, member_id=${app.member_id ?? "null"})`
    );
  }

  const { pipelineKey, teamKey, stageKeys, fieldKeys } =
    await ensureStreakReady();
  const targetStageKey = stageKeys[stage];
  const name = formatName(app.first_name ?? "", app.last_name ?? "");
  const company = app.company_name ?? "";

  let boxKey = app.streak_box_key as string | null;

  if (!boxKey) {
    const created = await createBox(pipelineKey, {
      name,
      stageKey: targetStageKey,
    });
    if (!created?.boxKey) {
      throw new Error(
        `pushApplicationToStreak: createBox for application ${applicationId} returned no boxKey`
      );
    }
    boxKey = created.boxKey;

    const update = await admin
      .from("applications")
      .update({ streak_box_key: boxKey })
      .eq("id", applicationId);
    if (update.error) {
      throw new Error(
        `pushApplicationToStreak: failed to persist streak_box_key for application ${applicationId}: ${update.error.message}`
      );
    }
  } else {
    await updateBox(boxKey, { name, stageKey: targetStageKey });
  }

  await setBoxField(boxKey, fieldKeys.first_name, app.first_name ?? "");
  await setBoxField(boxKey, fieldKeys.last_name, app.last_name ?? "");
  await setBoxField(boxKey, fieldKeys.company, company);
  await setBoxField(boxKey, fieldKeys.email, app.email ?? "");

  // Attach a Contact for mail merge — applications carry their email on the
  // row directly (no member_emails join yet).
  const appEmail = (app.email ?? "").trim();
  if (!appEmail) {
    void logSystemEvent({
      event_type: "streak.contact_skipped",
      metadata: { reason: "no_email", application_id: applicationId },
    });
    return;
  }
  await attachContactToBox({
    teamKey,
    boxKey,
    email: appEmail,
    firstName: app.first_name ?? "",
    lastName: app.last_name ?? "",
  });
}

export async function deleteApplicationBox(
  applicationId: string
): Promise<void> {
  const admin = createAdminClient("system-internal");
  const res = await admin
    .from("applications")
    .select("streak_box_key")
    .eq("id", applicationId)
    .single();
  if (res.error || !res.data) {
    throw new Error(
      `deleteApplicationBox: application ${applicationId} not found: ${res.error?.message ?? "no data"}`
    );
  }
  const boxKey = res.data.streak_box_key as string | null;
  if (!boxKey) return;

  await deleteBox(boxKey);

  const upd = await admin
    .from("applications")
    .update({ streak_box_key: null })
    .eq("id", applicationId);
  if (upd.error) {
    throw new Error(
      `deleteApplicationBox: failed to null streak_box_key for application ${applicationId}: ${upd.error.message}`
    );
  }
}

export async function deleteMemberBox(memberId: string): Promise<void> {
  const admin = createAdminClient("system-internal");
  const res = await admin
    .from("members")
    .select("streak_box_key")
    .eq("id", memberId)
    .single();
  if (res.error || !res.data) {
    throw new Error(
      `deleteMemberBox: member ${memberId} not found: ${res.error?.message ?? "no data"}`
    );
  }
  const boxKey = res.data.streak_box_key as string | null;
  if (!boxKey) return;

  await deleteBox(boxKey);

  const upd = await admin
    .from("members")
    .update({ streak_box_key: null })
    .eq("id", memberId);
  if (upd.error) {
    throw new Error(
      `deleteMemberBox: failed to null streak_box_key for member ${memberId}: ${upd.error.message}`
    );
  }
}

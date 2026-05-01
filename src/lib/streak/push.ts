/**
 * Streak push primitives. Idempotent: same OS state produces the same Streak
 * state. The streak_box_key column on members/applications is the durable
 * pointer — set on first push, used to update in place thereafter.
 *
 * These functions throw on Streak API failure. Callers (Prompt B wiring)
 * decide retry/logging policy. Library is inert until that wiring lands.
 */

import {
  createBox,
  deleteBox,
  setBoxField,
  updateBox,
} from "@/lib/streak/client";
import { ensureStreakReady } from "@/lib/streak/bootstrap";
import {
  computeStageForApplication,
  computeStageForMember,
  getMemberStreakState,
} from "@/lib/streak/compute-stage";
import { formatName } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

async function getMemberPrimaryEmail(
  admin: ReturnType<typeof createAdminClient>,
  memberId: string
): Promise<string> {
  const res = await admin
    .from("member_emails")
    .select("email")
    .eq("member_id", memberId)
    .eq("is_primary", true)
    .single();
  if (res.error || !res.data) {
    throw new Error(
      `pushMemberToStreak: no primary email for member ${memberId}: ${res.error?.message ?? "missing row"}`
    );
  }
  return res.data.email;
}

export async function pushMemberToStreak(memberId: string): Promise<void> {
  const admin = createAdminClient();

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

  const { pipelineKey, stageKeys, fieldKeys } = await ensureStreakReady();
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
  // accepts the same value as a no-op write.
  await setBoxField(boxKey, fieldKeys.first_name, member.first_name ?? "");
  await setBoxField(boxKey, fieldKeys.last_name, member.last_name ?? "");
  await setBoxField(boxKey, fieldKeys.company, company);
  await setBoxField(boxKey, fieldKeys.email, email);
}

export async function pushApplicationToStreak(
  applicationId: string
): Promise<void> {
  const admin = createAdminClient();

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

  const { pipelineKey, stageKeys, fieldKeys } = await ensureStreakReady();
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
}

export async function deleteApplicationBox(
  applicationId: string
): Promise<void> {
  const admin = createAdminClient();
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
  const admin = createAdminClient();
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

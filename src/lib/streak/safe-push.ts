/**
 * Safe wrappers around Prompt A's push primitives.
 *
 * The OS treats Streak sync as best-effort: every state-change call site
 * fires the appropriate safe-push AFTER its own DB transaction commits.
 * If the push throws (Streak API down, rate-limited, schema mismatch, etc.),
 * the OS state still stands — we log and move on.
 *
 * Failures land as `error.caught` rows in system_events with metadata
 * `{ source: 'streak_push', op, member_id?|application_id?, error }` so
 * Eric can review and re-run the relevant action manually.
 *
 * Logging itself is also wrapped — logSystemEvent already swallows its own
 * errors, but we double-belt the catch here so a logging failure can never
 * surface to a server action's success path.
 */

import { logSystemEvent } from "@/lib/system-events";
import {
  deleteApplicationBox,
  deleteMemberBox,
  pushApplicationToStreak,
  pushMemberToStreak,
} from "@/lib/streak/push";

function stringifyError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function logFailure(
  op: string,
  scope: { member_id?: string; application_id?: string },
  err: unknown
): Promise<void> {
  try {
    await logSystemEvent({
      event_type: "error.caught",
      metadata: {
        source: "streak_push",
        op,
        ...scope,
        error: stringifyError(err),
      },
    });
  } catch {
    // Already best-effort. logSystemEvent should never throw, but if it
    // somehow does, we still don't want to surface to the caller.
  }
}

export async function safePushMember(
  memberId: string,
  op: string
): Promise<void> {
  try {
    await pushMemberToStreak(memberId);
  } catch (err) {
    console.error(`[safePushMember] op=${op} member=${memberId}:`, err);
    await logFailure(op, { member_id: memberId }, err);
  }
}

export async function safePushApplication(
  applicationId: string,
  op: string
): Promise<void> {
  try {
    await pushApplicationToStreak(applicationId);
  } catch (err) {
    console.error(
      `[safePushApplication] op=${op} application=${applicationId}:`,
      err
    );
    await logFailure(op, { application_id: applicationId }, err);
  }
}

export async function safeDeleteApplicationBox(
  applicationId: string,
  op: string
): Promise<void> {
  try {
    await deleteApplicationBox(applicationId);
  } catch (err) {
    console.error(
      `[safeDeleteApplicationBox] op=${op} application=${applicationId}:`,
      err
    );
    await logFailure(op, { application_id: applicationId }, err);
  }
}

export async function safeDeleteMemberBox(
  memberId: string,
  op: string
): Promise<void> {
  try {
    await deleteMemberBox(memberId);
  } catch (err) {
    console.error(`[safeDeleteMemberBox] op=${op} member=${memberId}:`, err);
    await logFailure(op, { member_id: memberId }, err);
  }
}

/**
 * Streak bootstrap. Resolves the Thunderview pipeline, its 7 stages, and the
 * 4 custom fields used to populate every box. Caches the result in module
 * scope so subsequent calls don't hit Streak.
 *
 * Throws with a clear message if the pipeline or any stage is missing.
 * Auto-creates the 4 fields if any are missing — fields are additive and
 * cheap to add. Stages are not auto-created because Streak stages also
 * carry order + color and are intentionally curated in the UI.
 */

import {
  createPipelineField,
  getPipeline,
  listPipelineFields,
  listPipelines,
  listPipelineStages,
} from "@/lib/streak/client";
import { STAGE_NAMES, type StreakStage } from "@/lib/streak/stages";

export type StreakFieldKey = "first_name" | "last_name" | "company" | "email";

const FIELD_DISPLAY_NAMES: Record<StreakFieldKey, string> = {
  first_name: "First Name",
  last_name: "Last Name",
  company: "Company",
  email: "Email",
};

export type StreakBootstrap = {
  pipelineKey: string;
  /** Team that owns the Thunderview pipeline. Contacts are team-scoped. */
  teamKey: string;
  stageKeys: Record<StreakStage, string>;
  fieldKeys: Record<StreakFieldKey, string>;
};

let cached: StreakBootstrap | null = null;

export function resetStreakCache(): void {
  cached = null;
}

export async function ensureStreakReady(): Promise<StreakBootstrap> {
  if (cached) return cached;

  // 1. Find the Thunderview pipeline.
  const pipelines = await listPipelines();
  const pipeline = pipelines.find((p) => p.name === "Thunderview");
  if (!pipeline) {
    throw new Error(
      `Streak bootstrap: pipeline named "Thunderview" not found. Found: ${pipelines.map((p) => p.name).join(", ") || "(none)"}`
    );
  }
  const pipelineKey = pipeline.pipelineKey;

  // 2. Resolve all 7 stages by exact name.
  const stagesResp = await listPipelineStages(pipelineKey);
  const stagesByName = new Map<string, string>();
  for (const [key, row] of Object.entries(stagesResp)) {
    if (row?.name) stagesByName.set(row.name, key);
  }
  const stageKeys = {} as Record<StreakStage, string>;
  const missingStages: string[] = [];
  for (const [internal, displayName] of Object.entries(STAGE_NAMES) as Array<
    [StreakStage, string]
  >) {
    const key = stagesByName.get(displayName);
    if (!key) {
      missingStages.push(displayName);
    } else {
      stageKeys[internal] = key;
    }
  }
  if (missingStages.length > 0) {
    throw new Error(
      `Streak bootstrap: pipeline "Thunderview" is missing stage(s): ${missingStages.join(", ")}. Create them in the Streak UI with these exact names.`
    );
  }

  // 3. Resolve / auto-create the 4 custom fields.
  const fields = await listPipelineFields(pipelineKey);
  const fieldsByName = new Map<string, string>();
  for (const f of fields) {
    if (f?.name && f?.key) fieldsByName.set(f.name, f.key);
  }
  const fieldKeys = {} as Record<StreakFieldKey, string>;
  for (const [internal, displayName] of Object.entries(
    FIELD_DISPLAY_NAMES
  ) as Array<[StreakFieldKey, string]>) {
    const existing = fieldsByName.get(displayName);
    if (existing) {
      fieldKeys[internal] = existing;
      continue;
    }
    const created = await createPipelineField(pipelineKey, {
      name: displayName,
    });
    if (!created?.key) {
      throw new Error(
        `Streak bootstrap: createPipelineField for "${displayName}" returned no key`
      );
    }
    fieldKeys[internal] = created.key;
  }

  // 4. Resolve the team that owns this pipeline. Streak's pipeline GET
  //    response carries `teamKey` directly — use it. There is no public
  //    /users/me/teams endpoint despite what some docs imply (it returns
  //    400 "Invalid API path"). The pipeline-owns-the-team relationship
  //    is the canonical resolution.
  const pipelineDetail = (await getPipeline(pipelineKey)) as {
    pipelineKey: string;
    name: string;
    teamKey?: string;
  };
  const teamKey = pipelineDetail.teamKey;
  if (!teamKey) {
    throw new Error(
      `Streak bootstrap: pipeline "${pipelineDetail.name}" GET response did not include teamKey — cannot scope Contacts API calls`
    );
  }

  cached = { pipelineKey, teamKey, stageKeys, fieldKeys };
  return cached;
}

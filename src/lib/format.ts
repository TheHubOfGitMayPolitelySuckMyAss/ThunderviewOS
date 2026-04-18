/** Display-friendly stage/type labels. Stored values are unchanged. */
export function formatStageType(raw: string | null | undefined): string {
  if (!raw) return "-";
  if (raw === "Active CEO (Bootstrapping or VC-Backed)") return "Active CEO";
  if (raw === "Exited CEO (Acquisition or IPO)") return "Exited CEO";
  return raw;
}

import { readAtlas, readDocket } from "@/lib/atlas/read";
import PageHeader from "@/components/page-header";
import AtlasView from "./atlas-view";

// /admin/atlas — the living map (docs/atlas/**) + open-work docket
// (docs/docket.md). Ported from knownquantity's /admin/atlas (originally
// DigiEric's), restyled to this repo's design system; this repo runs no
// notes inbox, so the todos capture surface is omitted. Auth comes from the
// admin layout; the fs reads need docs/** traced into the function bundle
// (outputFileTracingIncludes in next.config.ts).

export default function AtlasPage() {
  const domains = readAtlas();
  const docket = readDocket();

  return (
    <div className="tv-container-admin space-y-6">
      <PageHeader
        title="Atlas"
        lede="The living map — why each feature exists, how it works, and every decision that shaped it. Maintained by agents under the same-commit rule; convention in docs/atlas/README.md."
        size="compact"
      />
      <AtlasView domains={domains} docket={docket} />
    </div>
  );
}

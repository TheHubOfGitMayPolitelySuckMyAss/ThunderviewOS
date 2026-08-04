/**
 * Atlas + Docket readers — parse the living project map under docs/atlas/
 * and the open-work docket at docs/docket.md into render-ready trees.
 *
 * Plain server lib — reads the repo's own markdown via fs at request time.
 * The /admin/atlas server page is the only consumer; its function bundle
 * must include the docs via outputFileTracingIncludes in next.config.ts.
 * Ported from knownquantity's lib/atlas (this repo runs no notes inbox, so
 * the notes reader is omitted).
 *
 * Convention (authoritative doc: docs/atlas/README.md):
 *   docs/atlas/<domain>/_domain.md          domain node
 *   docs/atlas/<domain>/<feature>.md        feature node
 *   docs/atlas/<domain>/<feature>/<sub>.md  sub-feature (dir named after parent)
 * Node = frontmatter (title/why/what/status) + ## How + ## Decisions + ## Graveyard.
 */

import fs from "node:fs";
import path from "node:path";
import { markdownToHtml } from "./markdown";

export type AtlasNode = {
  slug: string; // path relative to docs/atlas, without extension
  title: string;
  why: string;
  what: string;
  status: string; // live | parked | deprecated
  howHtml: string | null;
  decisionsHtml: string | null;
  graveyardHtml: string | null;
  children: AtlasNode[];
};

export type DocketSection = { title: string; html: string };

const ATLAS_DIR = path.join(process.cwd(), "docs", "atlas");
const DOCKET_PATH = path.join(process.cwd(), "docs", "docket.md");

/** Fixed presentation order (the funnel: apply → member → ticket → dinner,
 *  then the systems around it); unknown domains append A→Z. */
const DOMAIN_ORDER = ["applications", "members", "tickets", "dinners", "email", "observability"];

/**
 * Tolerant frontmatter parse — frontmatter is flat `key: prose` lines, and
 * prose legitimately contains `: ` sequences that strict YAML rejects; each
 * entry splits on its FIRST `: `, lines without a separator continue the
 * previous key. Authors shouldn't need YAML quoting discipline.
 */
function parseFrontmatter(raw: string): { data: Record<string, string>; content: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, content: raw };
  const data: Record<string, string> = {};
  let lastKey: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const sep = line.indexOf(": ");
    if (sep > 0 && !/^\s/.test(line)) {
      const key = line.slice(0, sep).trim();
      // Strip a trailing inline comment on simple scalar lines (e.g. status).
      data[key] = line.slice(sep + 2).trim().replace(/\s+#.*$/, "");
      lastKey = key;
    } else if (lastKey) {
      data[lastKey] = `${data[lastKey]} ${line.trim()}`.trim();
    }
  }
  return { data, content: m[2] };
}

/** Split a node body into its `## <Name>` sections (lowercased name → raw md). */
function splitSections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const matches = [...body.matchAll(/^## +(.+)$/gm)];
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim().toLowerCase();
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? body.length) : body.length;
    out[name] = body.slice(start, end).trim();
  }
  return out;
}

function toHtml(md: string | undefined): string | null {
  return md ? markdownToHtml(md) : null;
}

function readNodeFile(filePath: string, slug: string): AtlasNode | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  const { data, content } = parseFrontmatter(raw);
  const sections = splitSections(content);
  return {
    slug,
    title: String(data.title ?? path.basename(slug)),
    why: String(data.why ?? ""),
    what: String(data.what ?? ""),
    status: String(data.status ?? "live"),
    howHtml: toHtml(sections["how"]),
    decisionsHtml: toHtml(sections["decisions"]),
    graveyardHtml: toHtml(sections["graveyard"]),
    children: [],
  };
}

/** Read one directory level of feature nodes; a sibling dir named after a
 *  feature file nests its .md files as that feature's children. */
function readFeatureNodes(dir: string, slugPrefix: string): AtlasNode[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nodes: AtlasNode[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".md")) continue;
    if (e.name === "_domain.md" || e.name === "README.md") continue;
    const base = e.name.replace(/\.md$/, "");
    const node = readNodeFile(path.join(dir, e.name), `${slugPrefix}/${base}`);
    if (!node) continue;
    const childDir = path.join(dir, base);
    if (fs.existsSync(childDir) && fs.statSync(childDir).isDirectory()) {
      node.children = readFeatureNodes(childDir, `${slugPrefix}/${base}`);
    }
    nodes.push(node);
  }
  return nodes.sort((a, b) => a.title.localeCompare(b.title));
}

/** The full atlas: one root node per domain directory, ordered. */
export function readAtlas(): AtlasNode[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(ATLAS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const domains: AtlasNode[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(ATLAS_DIR, e.name);
    const domainNode =
      readNodeFile(path.join(dir, "_domain.md"), e.name) ??
      // Domain dir without _domain.md yet (mid-mine): synthesize a stub so
      // whatever nodes exist still render.
      ({
        slug: e.name,
        title: e.name,
        why: "",
        what: "(domain node not yet written)",
        status: "live",
        howHtml: null,
        decisionsHtml: null,
        graveyardHtml: null,
        children: [],
      } satisfies AtlasNode);
    domainNode.children = readFeatureNodes(dir, e.name);
    domains.push(domainNode);
  }
  return domains.sort((a, b) => {
    const ai = DOMAIN_ORDER.indexOf(a.slug);
    const bi = DOMAIN_ORDER.indexOf(b.slug);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.slug.localeCompare(b.slug);
  });
}

/** The docket: every `## ` section of docs/docket.md, in file order. */
export function readDocket(): DocketSection[] {
  let raw: string;
  try {
    raw = fs.readFileSync(DOCKET_PATH, "utf8");
  } catch {
    return [];
  }
  const matches = [...raw.matchAll(/^## +(.+)$/gm)];
  return matches.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    return { title: m[1].trim(), html: markdownToHtml(raw.slice(start, end).trim()) };
  });
}

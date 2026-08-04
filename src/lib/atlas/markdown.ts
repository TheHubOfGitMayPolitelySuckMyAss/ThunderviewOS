/**
 * Minimal Markdown → HTML for atlas node sections and the docket.
 *
 * A deliberately small, hand-rolled subset (ported from knownquantity's
 * /admin/atlas renderer, itself from DigiEric) so the output is predictable:
 * the atlas convention keeps sections to one bounded screen of plain prose,
 * lists, and inline code — full CommonMark would be wasted surface.
 *
 * Block syntax (line-leading):
 *   ### / ####        → <h3>/<h4>   (## is the section splitter, never reaches here)
 *   > text            → <blockquote><p>…</p></blockquote>
 *   - text  /  * text → <ul><li>…</li></ul>
 *   1. text           → <ol><li>…</li></ol>
 *   ---               → <hr>
 *   (anything else)   → <p>…</p>  (single \n inside a paragraph → <br>)
 *
 * Inline syntax: **b**  *i*  `code`  [text](url)
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape, then apply inline spans. Order matters: escape first. */
function inline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  return s;
}

export function markdownToHtml(md: string): string {
  const lines = (md ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const isBlank = (l: string) => l.trim() === "";

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    const h = line.match(/^(#{3,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote><p>${inline(buf.join("\n")).replace(/\n/g, "<br>\n")}</p></blockquote>`);
      continue;
    }

    // List items may wrap onto indented continuation lines — fold them in.
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^[-*]\s+/, "").trim();
        i++;
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !/^\s+[-*]\s+/.test(lines[i])) {
          item += ` ${lines[i].trim()}`;
          i++;
        }
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\d+\.\s+/, "").trim();
        i++;
        while (i < lines.length && /^\s+\S/.test(lines[i]) && !/^\s+\d+\.\s+/.test(lines[i])) {
          item += ` ${lines[i].trim()}`;
          i++;
        }
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Paragraph — collect consecutive non-blank lines that aren't another block
    const para: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !/^(#{3,4}\s|>\s?|[-*]\s+|\d+\.\s+)/.test(lines[i]) &&
      !/^(-{3,}|\*{3,})$/.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(para.join("\n")).replace(/\n/g, "<br>\n")}</p>`);
  }

  return out.join("\n");
}

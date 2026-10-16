export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Inline formatting after escaping: **bold** and *italic* only. */
function inline(s: string) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>");
}

/**
 * Converts the plain-text editor content to safe HTML for the Webflow rich text field.
 * Supported: "## Heading", "- bullet" lists, "1. numbered" lists, **bold**, *italic*, blank-line paragraphs.
 * Everything is escaped first, so editors cannot inject markup or scripts into the public site.
 */
export function textToHtml(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      closeList();
      continue;
    }
    const h = line.match(/^#{1,3}\s+(.+)$/);
    const ul = line.match(/^[-*•]\s+(.+)$/);
    const ol = line.match(/^\d+[.)]\s+(.+)$/);
    if (h) {
      flushPara();
      closeList();
      out.push(`<h5>${inline(h[1])}</h5>`);
    } else if (ul || ol) {
      flushPara();
      const want = ul ? "ul" : "ol";
      if (list !== want) {
        closeList();
        out.push(`<${want}>`);
        list = want;
      }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
    } else {
      closeList();
      para.push(line);
    }
  }
  flushPara();
  closeList();
  return out.join("");
}

/** Only ClickUp form links are accepted as the apply link. */
export function validateClickupLink(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Enter a valid URL." };
  }
  if (u.protocol !== "https:") return { ok: false, error: "The link must start with https://." };
  if (u.hostname !== "forms.clickup.com") return { ok: false, error: "Only ClickUp form links (forms.clickup.com) are allowed." };
  if (u.pathname.length < 5) return { ok: false, error: "That does not look like a complete ClickUp form link." };
  return { ok: true, url: u.toString() };
}

export const fmtDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso.includes("T") || iso.endsWith("Z") ? iso : iso.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
};

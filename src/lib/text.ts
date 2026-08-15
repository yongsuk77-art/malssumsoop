export function stripStrongTags(text: string): string {
  return text.replace(/<W[HG][^>]+>/gi, "").replace(/\s+/g, " ").trim();
}

export function strongCodes(text: string): string[] {
  return [...text.matchAll(/<W([HG])([^>]+)>/gi)].map((match) => `${match[1].toUpperCase()}${match[2]}`);
}

export function legacyHtmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/div\s*>/gi, "\n");
  const document = new DOMParser().parseFromString(withBreaks, "text/html");
  return (document.body.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeStrong(code: string): string {
  const match = code.trim().toUpperCase().match(/^([HG])0*(\d+[A-Z]?)$/);
  return match ? `${match[1]}${match[2]}` : code.trim().toUpperCase();
}

export type TaggedSegment = { text: string; codes: string[] };

export function taggedSegments(text: string): TaggedSegment[] {
  const segments: TaggedSegment[] = [];
  const matcher = /<W([HG])([^>]+)>/gi;
  let cursor = 0;
  for (const match of text.matchAll(matcher)) {
    const index = match.index ?? cursor;
    const visible = text.slice(cursor, index);
    const code = normalizeStrong(`${match[1]}${match[2]}`);
    if (visible) segments.push({ text: visible, codes: [code] });
    else if (segments.length) segments[segments.length - 1].codes.push(code);
    cursor = index + match[0].length;
  }
  const remainder = text.slice(cursor);
  if (remainder) segments.push({ text: remainder, codes: [] });
  return segments;
}

export function contentBlockReady(
  source: string,
  kind: "code" | "table" | "details",
  streaming: boolean,
  followed: boolean,
): boolean {
  if (kind === "code") {
    const opening = /^\s*(`{3,}|~{3,})/.exec(source)?.[1];
    if (!opening) return !streaming || followed;
    const closing = /\n[ \t>]*(`{3,}|~{3,})[ \t\r]*$/.exec(source)?.[1];
    return Boolean(closing && closing[0] === opening[0] && closing.length >= opening.length);
  }
  if (kind === "details") {
    let depth = 0;
    for (const match of source.matchAll(/<\/?details\b[^>]*>/gi)) {
      depth += match[0].startsWith("</") ? -1 : 1;
      if (depth < 0) return false;
    }
    return depth === 0 && /<\/details\s*>\s*$/i.test(source);
  }
  return !streaming || followed;
}

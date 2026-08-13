/**
 * URL-safe slug from arbitrary text.
 *
 * Strips diacritics so "Café Cinématique" becomes "cafe-cinematique" rather
 * than dropping the accented characters entirely.
 */
export function slugify(input: string, maxLength = 60): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/**
 * Appends -2, -3 … until the slug is unique.
 * `taken` is the set of slugs already in use.
 */
export function uniqueSlug(base: string, taken: Set<string> | string[]): string {
  const used = taken instanceof Set ? taken : new Set(taken);
  const root = slugify(base) || "prompt";
  if (!used.has(root)) return root;

  for (let i = 2; i < 1000; i++) {
    const candidate = `${root}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  // Practically unreachable; keeps the return type honest.
  return `${root}-${Date.now()}`;
}

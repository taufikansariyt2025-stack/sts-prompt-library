/**
 * Cleanup for prompt text imported from the source document.
 *
 * The .docx prompts were OCR'd from screenshots, which introduced two
 * repeatable artefacts:
 *   · hyphenated line breaks — "com- mercial", "specu-lar"
 *   · stutter duplication    — "rendering, rendering,", "cutting cutting"
 *
 * This is opt-in from the admin UI and always shown as a diff before applying.
 * It is never run silently, because a false positive would corrupt a prompt.
 */

export type CleanupResult = {
  text: string;
  changed: boolean;
  fixes: { label: string; count: number }[];
};

export function cleanPromptText(input: string): CleanupResult {
  let text = input;
  const fixes: { label: string; count: number }[] = [];

  const track = (label: string, before: string, after: string, count: number) => {
    if (before !== after && count > 0) fixes.push({ label, count });
  };

  // 1. Re-join hyphen-split words: "com- mercial" → "commercial".
  //    Requires lowercase either side so real compounds ("9:16 - vertical",
  //    "Anti-Pollution") survive.
  {
    const before = text;
    const matches = text.match(/([a-z]{2,})-\s+([a-z]{2,})/g)?.length ?? 0;
    text = text.replace(/([a-z]{2,})-\s+([a-z]{2,})/g, "$1$2");
    track("Re-joined hyphen-split words", before, text, matches);
  }

  // 2. Collapse immediate word stutters: "rendering, rendering," → "rendering,".
  //    Case-insensitive on the word, but the separator must repeat too.
  {
    const before = text;
    const pattern = /\b(\w{3,})(,?)\s+\1\2(?=\s|$|[.,;:])/gi;
    const matches = text.match(pattern)?.length ?? 0;
    text = text.replace(pattern, "$1$2");
    track("Collapsed duplicated words", before, text, matches);
  }

  // 3. Normalise the odd whitespace characters Word leaves behind.
  {
    const before = text;
    const matches = text.match(/[   \t]/g)?.length ?? 0;
    text = text.replace(/[   ]/g, " ").replace(/\t/g, "  ");
    track("Normalised whitespace", before, text, matches);
  }

  // 4. Collapse runs of spaces, but never touch newlines — the timestamp and
  //    shot-list structure depends on them.
  {
    const before = text;
    const matches = text.match(/[^\S\n]{2,}/g)?.length ?? 0;
    text = text.replace(/[^\S\n]{2,}/g, " ");
    track("Collapsed repeated spaces", before, text, matches);
  }

  // 5. Cap runaway blank lines at one, and trim the ends.
  {
    const before = text;
    const matches = text.match(/\n{3,}/g)?.length ?? 0;
    text = text.replace(/\n{3,}/g, "\n\n").trim();
    track("Trimmed excess blank lines", before, text, matches);
  }

  return { text, changed: text !== input, fixes };
}

/** Rough word count for the editor's character/word readout. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** First meaningful line, used to suggest a title on import. */
export function suggestTitle(text: string, maxLength = 70): string {
  const firstLine =
    text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 12) ?? text.trim();

  const sentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine;
  const cleaned = sentence.replace(/^[^A-Za-z0-9]+/, "").trim();

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).replace(/\s+\S*$/, "")}…`;
}

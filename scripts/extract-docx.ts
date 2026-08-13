/**
 * Extracts prompts from the source .docx into a reviewable JSON file.
 *
 *   pnpm extract:docx [path/to/file.docx]
 *
 * Output: scripts/data/extracted-prompts.json
 *
 * Deliberately separate from `pnpm seed`, so the extraction can be inspected
 * and hand-corrected before anything reaches the database.
 *
 * What the source document actually contains (see PRD §2):
 *   · 60 real prompts, followed by ~33 empty duplicate template blocks
 *   · every metadata placeholder ("Category • AI Tool • Date") left unfilled
 *   · embedded images that are Instagram screenshots, unusable as previews
 *
 * So this script recovers the prompt TEXT accurately and leaves classification
 * to a human in the admin panel.
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { unzipSync, strFromU8 } from "fflate";

import { cleanPromptText } from "../lib/utils/clean-text";
import { detectPlaceholders } from "../lib/schemas/prompt";
import { slugify, uniqueSlug } from "../lib/utils/slug";

const DEFAULT_DOCX = "prompt-docs/AI Prompt Library .docx";
const OUTPUT = "scripts/data/extracted-prompts.json";

export type ExtractedPrompt = {
  sourceNumber: number;
  title: string;
  slug: string;
  promptText: string;
  negativePrompt: string;
  suggestedType: "image" | "video";
  suggestedAspectRatio?: string;
  suggestedDurationSeconds?: number;
  requiresReferenceImage: boolean;
  hasPlaceholders: boolean;
  placeholders: string[];
  charCount: number;
  /** True when the source document cut the prompt off mid-sentence. */
  likelyTruncated: boolean;
  cleanupApplied: string[];
};

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

/** Word stores each paragraph as <w:p>; runs of text inside as <w:t>. */
function readParagraphs(documentXml: string): string[] {
  const paragraphs = documentXml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) ?? [];

  return paragraphs.map((paragraph) => {
    const runs = paragraph.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [];
    const text = runs
      .map((run) => run.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>$/, ""))
      .join("");

    // <w:br/> is a soft line break inside a paragraph and carries meaning in
    // these prompts (timestamp lists, shot breakdowns).
    const withBreaks = /<w:br\s*\/>/.test(paragraph) ? `${text}\n` : text;
    return decodeXmlEntities(withBreaks);
  });
}

/** Splits the flat paragraph stream into per-prompt blocks. */
function splitIntoBlocks(paragraphs: string[]) {
  const blocks: { number: number; lines: string[] }[] = [];
  let current: { number: number; lines: string[] } | null = null;

  for (const line of paragraphs) {
    const header = line.trim().match(/^Prompt\s+(\d+)$/i);
    if (header) {
      if (current) blocks.push(current);
      current = { number: Number(header[1]), lines: [] };
      continue;
    }
    current?.lines.push(line);
  }
  if (current) blocks.push(current);
  return blocks;
}

const NOISE = [
  /^Category\s*•\s*AI Tool\s*•\s*Date$/i,
  /^Preview\s*$/i,
  /^<br>$/i,
  /^(AI TOOL|MODEL|ASPECT RATIO|NOTES)$/i,
  /^-$/,
];

function extractBody(lines: string[]): { promptText: string; negativePrompt: string } {
  const kept: string[] = [];
  let started = false;

  for (const raw of lines) {
    const line = raw.replace(/\[\[IMAGE:[^\]]*\]\]/g, "").trimEnd();
    const trimmed = line.trim();

    // "## Prompt ❐" marks the start of the body in every block.
    const marker = trimmed.match(/^##\s*Prompt\s*[❐▢□]?\s*(.*)$/);
    if (marker) {
      started = true;
      if (marker[1]?.trim()) kept.push(marker[1].trim());
      continue;
    }

    if (!started) continue;
    if (NOISE.some((pattern) => pattern.test(trimmed))) continue;

    kept.push(line);
  }

  const full = kept.join("\n").trim();

  // Pull an explicit negative-prompt section into its own field.
  const negativeMatch = full.match(
    /\n\s*Negative Prompt:?\s*\n?([\s\S]*?)(?=\n\s*[A-Z][a-zA-Z ]{2,}:\s*\n|$)/i,
  );

  if (negativeMatch?.[1]) {
    return {
      promptText: full.slice(0, negativeMatch.index).trim(),
      negativePrompt: negativeMatch[1].trim(),
    };
  }

  return { promptText: full, negativePrompt: "" };
}

function guessType(text: string): "image" | "video" {
  const lower = text.toLowerCase();

  // A duration or shot-timing marker is the strongest possible video signal —
  // it beats everything else, including a passing mention of a storyboard.
  const decisiveVideo = [
    /\b\d+\s*-?\s*seconds?\b/,
    /\b\d+\s*s\s*[):,|]/,
    /\d+:\d{2}\s*[-\u2013]\s*\d+:\d{2}/,
    /\b\d+\s*-\s*\d+\s*s\s*:/,
    /\[\d{2}:\d{2}[-\u2013]/,
    /\bduration\b/,
    /\bslow motion\b/,
    /\bvoiceover\b/,
    /\bsound effects?\b/,
    /\bfps\b/,
  ];
  if (decisiveVideo.some((pattern) => pattern.test(lower))) return "video";

  // Only now does a storyboard / multi-image brief mean a still.
  const decisiveImage = [
    /\bstoryboard\b/,
    /\bgenerate \d+ separate\b/,
    /\b\d+ (?:separate |different )?(?:advertising |luxury |product )?images\b/,
    /\b\d\s*[\u00d7x]\s*\d\s*grid\b/,
    /\bcontact sheet\b/,
    /\bstill image\b/,
  ];
  if (decisiveImage.some((pattern) => pattern.test(lower))) return "image";

  // Default video: the corpus is ~85% motion prompts, so an ambiguous entry
  // describing only style and lighting is far more likely to be a video brief.
  return "video";
}

/**
 * Several prompts in the source document are cut off at ~1024 characters —
 * verified by comparing against the raw paragraph text, so it is the document
 * that is truncated, not this extractor. Flag them for manual completion.
 */
function looksTruncated(text: string): boolean {
  const trimmed = text.trim();
  const endsCleanly = /[.!?)"'\]]$/.test(trimmed);
  const nearLimit = trimmed.length >= 1000 && trimmed.length <= 1040;
  // Some entries are also cut off at the START — they open mid-sentence.
  const startsMidSentence = /^[a-z]/.test(trimmed) && !/^[a-z]+\s*[:\]]/.test(trimmed);
  return (nearLimit && !endsCleanly) || startsMidSentence;
}

/**
 * Turns a prompt body into a usable title.
 *
 * The raw first sentence is often a fragment ("[@0] as live-action reference",
 * "between the ingredients"), so leading bracket tokens and directive prefixes
 * are stripped before falling back to a generic name.
 */
function buildTitle(text: string, sourceNumber: number): string {
  let candidate = text
    // Drop a leading bracketed token: [@0], [Style], 【Duration】
    .replace(/^\s*[[【][^\]】]{0,40}[\]】]\s*/, "")
    // Drop common directive openers that carry no meaning in a title.
    .replace(
      /^\s*(?:create|generate|make|produce|use|using|show me)\b[^.\n]{0,20}?\b(?:a|an|the)\s+/i,
      "",
    )
    .replace(/^\s*(?:step\s*\d+[:.]?\s*)/i, "")
    .trimStart();

  const line =
    candidate
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 15) ?? candidate;

  const sentence = line.split(/(?<=[.!?])\s/)[0] ?? line;
  candidate = sentence.replace(/^[^A-Za-z0-9]+/, "").trim();

  // A fragment reads worse than a neutral placeholder. Catch the cases where
  // the source itself starts mid-sentence or trails off into a conjunction.
  const isFragment =
    candidate.length < 20 ||
    /^[a-z]/.test(candidate) ||
    /\b(and|the|with|of|in|a)$/i.test(candidate.replace(/[,.]$/, ""));
  if (isFragment) return `Prompt ${sourceNumber}`;

  const capped =
    candidate.length <= 70
      ? candidate
      : `${candidate.slice(0, 70).replace(/\s+\S*$/, "")}…`;

  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

function guessAspectRatio(text: string): string | undefined {
  const match = text.match(/\b(9:16|16:9|1:1|4:5|21:9|3:2)\b/);
  return match?.[1];
}

function guessDuration(text: string): number | undefined {
  const patterns = [
    /\b(\d{1,3})\s*-?\s*second\b/i,
    /\bDuration[:\s]+(\d{1,3})\s*s\b/i,
    /\b(\d{1,3})s\s+(?:video|commercial|film|montage)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ? Number(match[1]) : NaN;
    if (Number.isFinite(value) && value > 0 && value <= 600) return value;
  }
  return undefined;
}

function needsReferenceImage(text: string): boolean {
  return /\b(uploaded|reference image|use the (woman|character|product)|@Image\d|first reference|attached image|product photo)\b/i.test(
    text,
  );
}

function main() {
  const docxPath = resolve(process.argv[2] ?? DEFAULT_DOCX);
  console.log(`Reading ${docxPath}`);

  const archive = unzipSync(new Uint8Array(readFileSync(docxPath)));
  const documentXml = archive["word/document.xml"];
  if (!documentXml) throw new Error("word/document.xml not found — is this a .docx?");

  const paragraphs = readParagraphs(strFromU8(documentXml));
  const blocks = splitIntoBlocks(paragraphs);
  console.log(`Found ${blocks.length} "Prompt N" blocks`);

  const slugs = new Set<string>();
  const seenText = new Set<string>();
  const prompts: ExtractedPrompt[] = [];
  let skippedEmpty = 0;
  let skippedDuplicate = 0;

  for (const block of blocks) {
    const { promptText: rawText, negativePrompt } = extractBody(block.lines);

    // The tail of the document is ~33 empty duplicate template blocks.
    if (rawText.length < 40) {
      skippedEmpty += 1;
      continue;
    }

    const fingerprint = rawText.slice(0, 200).toLowerCase().replace(/\s+/g, " ");
    if (seenText.has(fingerprint)) {
      skippedDuplicate += 1;
      continue;
    }
    seenText.add(fingerprint);

    const cleaned = cleanPromptText(rawText);
    const title = buildTitle(cleaned.text, block.number);
    const slug = uniqueSlug(slugify(title), slugs);
    slugs.add(slug);

    const placeholders = detectPlaceholders(cleaned.text);

    prompts.push({
      sourceNumber: block.number,
      title,
      slug,
      promptText: cleaned.text,
      negativePrompt: negativePrompt ? cleanPromptText(negativePrompt).text : "",
      suggestedType: guessType(cleaned.text),
      suggestedAspectRatio: guessAspectRatio(cleaned.text),
      suggestedDurationSeconds: guessDuration(cleaned.text),
      requiresReferenceImage: needsReferenceImage(cleaned.text),
      hasPlaceholders: placeholders.length > 0,
      placeholders,
      charCount: cleaned.text.length,
      likelyTruncated: looksTruncated(cleaned.text),
      cleanupApplied: cleaned.fixes.map((f) => f.label),
    });
  }

  const outputPath = resolve(OUTPUT);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(prompts, null, 2), "utf8");

  const videos = prompts.filter((p) => p.suggestedType === "video").length;

  console.log(`
✓ Extracted ${prompts.length} prompts → ${OUTPUT}
  skipped ${skippedEmpty} empty template blocks
  skipped ${skippedDuplicate} duplicates
  ${videos} video · ${prompts.length - videos} image
  ${prompts.filter((p) => p.hasPlaceholders).length} contain template placeholders
  ${prompts.filter((p) => p.requiresReferenceImage).length} need a reference image
  ${prompts.filter((p) => p.likelyTruncated).length} appear TRUNCATED in the source — paste the full text in the admin panel

Next: review the JSON, then run  pnpm seed`);
}

main();

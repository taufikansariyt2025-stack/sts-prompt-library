import { describe, expect, it } from "vitest";

import { cleanPromptText, suggestTitle } from "@/lib/utils/clean-text";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { detectPlaceholders } from "@/lib/schemas/prompt";

describe("slugify", () => {
  it.each([
    ["Cinematic Desert SUV Jump", "cinematic-desert-suv-jump"],
    ["Café Cinématique", "cafe-cinematique"],
    ["  Multiple   Spaces  ", "multiple-spaces"],
    ["Snickers — Amber Void 9:16", "snickers-amber-void-9-16"],
    ["!!!", ""],
  ])("slugifies %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("never ends with a hyphen after truncation", () => {
    expect(slugify("a".repeat(40) + " " + "b".repeat(40))).not.toMatch(/-$/);
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug when free", () => {
    expect(uniqueSlug("Hot Dog", [])).toBe("hot-dog");
  });

  it("appends a counter on collision", () => {
    expect(uniqueSlug("Hot Dog", ["hot-dog"])).toBe("hot-dog-2");
    expect(uniqueSlug("Hot Dog", ["hot-dog", "hot-dog-2"])).toBe("hot-dog-3");
  });

  it("falls back to a placeholder for empty input", () => {
    expect(uniqueSlug("!!!", [])).toBe("prompt");
  });
});

describe("cleanPromptText", () => {
  it("re-joins hyphen-split words from OCR", () => {
    const { text } = cleanPromptText("a premium com- mercial with specu- lar highlights");
    expect(text).toBe("a premium commercial with specular highlights");
  });

  it("leaves real hyphenated compounds alone", () => {
    const input = "Anti-Pollution brightening, golden-hour lighting";
    expect(cleanPromptText(input).text).toBe(input);
  });

  it("collapses duplicated words", () => {
    const { text } = cleanPromptText("cinematic rendering, rendering, with cutting cutting edges");
    expect(text).toBe("cinematic rendering, with cutting edges");
  });

  it("preserves newlines and timestamp structure", () => {
    const input = "0-4s: [Medium Wide] Push in.\n\n4-8s: [Tracking] Orbit.";
    expect(cleanPromptText(input).text).toBe(input);
  });

  it("reports when nothing changed", () => {
    expect(cleanPromptText("A clean prompt.").changed).toBe(false);
  });

  it("caps runs of blank lines at one", () => {
    expect(cleanPromptText("a\n\n\n\n\nb").text).toBe("a\n\nb");
  });
});

describe("detectPlaceholders", () => {
  it("finds bracket and brace template tokens", () => {
    const found = detectPlaceholders("A premium [Product Name] in a {product type} setting");
    expect(found).toContain("[Product Name]");
    expect(found).toContain("{product type}");
  });

  it("finds reference-image tokens", () => {
    expect(detectPlaceholders("Heroine @Image1 stands still")).toContain("@Image1");
  });

  it("ignores shot labels and timestamps", () => {
    const found = detectPlaceholders("0-4s: [Medium Wide] then [Slow 360 Orbital]");
    expect(found).not.toContain("[Medium Wide]");
    expect(found).not.toContain("[Slow 360 Orbital]");
  });
});

describe("suggestTitle", () => {
  it("uses the first meaningful sentence", () => {
    const title = suggestTitle("A cinematic wide shot of a man in a desert. Then an SUV jumps.");
    expect(title).toBe("A cinematic wide shot of a man in a desert.");
  });

  it("truncates long lines on a word boundary", () => {
    const title = suggestTitle("word ".repeat(40), 30);
    expect(title.length).toBeLessThanOrEqual(31);
    expect(title.endsWith("…")).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { OBJECT_KEY } = await import("@/lib/schemas/media");
const { mediaUrlSchema } = await import("@/lib/schemas/media");

/**
 * /api/media/[...key] takes a user-controlled path and hands it to the storage
 * client. The key pattern is the only thing standing between that route and
 * arbitrary object reads, so it gets tested directly.
 */
describe("OBJECT_KEY", () => {
  it.each([
    "prompts/2026/08/a7Kd93nQx2Lp.webp",
    "categories/2026/01/AbCdEf123456.png",
    "branding/2025/12/zzzzzzzzzzzz.svg",
  ])("accepts a key we minted: %s", (key) => {
    expect(OBJECT_KEY.test(key)).toBe(true);
  });

  it.each([
    ["../../../etc/passwd", "path traversal"],
    ["prompts/../../secret.webp", "traversal mid-key"],
    ["prompts/2026/08/../../../x.webp", "traversal after a valid prefix"],
    ["secrets/2026/08/a7Kd93nQx2Lp.webp", "scope not in the allowlist"],
    ["prompts/2026/08/short.webp", "id too short"],
    ["prompts/2026/08/waytoolongforanid.webp", "id too long"],
    ["prompts/26/08/a7Kd93nQx2Lp.webp", "malformed year"],
    ["prompts/2026/8/a7Kd93nQx2Lp.webp", "unpadded month"],
    ["prompts/2026/08/a7Kd93nQx2Lp.exe", "executable extension"],
    ["prompts/2026/08/a7Kd93nQx2Lp", "no extension"],
    ["/prompts/2026/08/a7Kd93nQx2Lp.webp", "leading slash"],
    ["prompts/2026/08/a7Kd93nQx2Lp.webp\n", "trailing newline"],
    ["", "empty"],
  ])("rejects %s (%s)", (key) => {
    expect(OBJECT_KEY.test(key)).toBe(false);
  });
});

describe("mediaUrlSchema", () => {
  it("accepts our own gated media paths", () => {
    expect(mediaUrlSchema.safeParse("/api/media/prompts/2026/08/a7Kd93nQx2Lp.webp").success).toBe(true);
  });

  it("accepts an absolute https URL for externally linked images", () => {
    expect(mediaUrlSchema.safeParse("https://example.com/a.jpg").success).toBe(true);
  });

  it.each([
    ["/api/media/../../../etc/passwd", "traversal in a media path"],
    ["javascript:alert(1)", "javascript scheme"],
    ["/etc/passwd", "arbitrary local path"],
    ["//evil.com/a.jpg", "protocol-relative URL"],
    ["not a url", "garbage"],
  ])("rejects %s (%s)", (value) => {
    expect(mediaUrlSchema.safeParse(value).success).toBe(false);
  });
});

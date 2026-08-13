import { describe, expect, it } from "vitest";

import { parseYouTube, youtubeAspect, youtubeEmbedUrl } from "@/lib/youtube/parse";

const ID = "dQw4w9WgXcQ";

describe("parseYouTube", () => {
  it("detects Shorts and marks them vertical", () => {
    const result = parseYouTube(`https://www.youtube.com/shorts/${ID}`);
    expect(result).toEqual({ ok: true, data: { id: ID, format: "short", startSeconds: undefined } });
  });

  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, "watch"],
    [`https://youtu.be/${ID}`, "short link"],
    [`https://www.youtube.com/embed/${ID}`, "embed"],
    [`https://www.youtube-nocookie.com/embed/${ID}`, "no-cookie embed"],
    [`https://www.youtube.com/live/${ID}`, "live"],
    [`https://m.youtube.com/watch?v=${ID}`, "mobile"],
    [`youtube.com/watch?v=${ID}`, "no protocol"],
    [ID, "bare id"],
  ])("parses %s (%s)", (url) => {
    const result = parseYouTube(url);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(ID);
      expect(result.data.format).toBe("video");
    }
  });

  it("keeps the id when extra query params are present", () => {
    const result = parseYouTube(`https://www.youtube.com/watch?v=${ID}&list=PLabc&index=2`);
    expect(result.ok && result.data.id).toBe(ID);
  });

  it.each([
    [`https://www.youtube.com/watch?v=${ID}&t=42`, 42],
    [`https://www.youtube.com/watch?v=${ID}&t=42s`, 42],
    [`https://www.youtube.com/watch?v=${ID}&t=1m30s`, 90],
    [`https://www.youtube.com/watch?v=${ID}&start=15`, 15],
  ])("extracts the start time from %s", (url, expected) => {
    const result = parseYouTube(url);
    expect(result.ok && result.data.startSeconds).toBe(expected);
  });

  it.each([
    ["https://vimeo.com/12345678", "non-YouTube host"],
    ["https://www.youtube.com/watch?v=tooshort", "malformed id"],
    ["https://www.youtube.com/", "no id"],
    ["not a url at all", "garbage"],
    ["", "empty"],
    ["https://evil.com/youtube.com/watch?v=" + ID, "host spoofing via path"],
    ["https://youtube.com.evil.com/watch?v=" + ID, "host spoofing via subdomain"],
  ])("rejects %s (%s)", (url) => {
    expect(parseYouTube(url).ok).toBe(false);
  });
});

describe("youtubeEmbedUrl", () => {
  it("always uses the privacy-enhanced domain", () => {
    expect(youtubeEmbedUrl(ID)).toContain("youtube-nocookie.com");
  });

  it("includes the start offset when given", () => {
    expect(youtubeEmbedUrl(ID, { startSeconds: 30 })).toContain("start=30");
  });
});

describe("youtubeAspect", () => {
  it("returns a vertical ratio for Shorts and horizontal otherwise", () => {
    expect(youtubeAspect("short")).toBeCloseTo(0.5625);
    expect(youtubeAspect("video")).toBeCloseTo(1.7778, 3);
  });
});

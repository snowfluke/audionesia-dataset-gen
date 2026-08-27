import { describe, expect, it } from "bun:test";

import type { ExportRow } from "../../src/lib/export/manifest.ts";
import {
  clipFileName,
  hfMetadataLine,
  oodLine,
  partition,
  pocketTtsLine,
  relativeClipPath,
  speakersJsonlLine,
  splitFor,
  styleTts2Line,
} from "../../src/lib/export/manifest.ts";

const ROW: ExportRow = {
  clipId: "3f1c2a2e-0000-4000-8000-000000000001",
  hash: "ba7816bf8f01cfea",
  path: "dataset/audio/budi/clip_0001.wav",
  relativePath: "audio/budi/clip_0001.wav",
  text: "Halo apa kabar.",
  phonemes: "halo apa kabar.",
  transcript: "Halo apa kabar.",
  durationSec: 3.2004,
  speakerId: "budi",
  speakerIndex: 0,
  split: "train",
};

describe("manifest lines", () => {
  it("names clips with a four-digit sequence", () => {
    expect(clipFileName(1)).toBe("clip_0001.wav");
    expect(relativeClipPath("budi", 12)).toBe("audio/budi/clip_0012.wav");
  });

  it("writes the speakers.jsonl line in the requested shape", () => {
    expect(JSON.parse(speakersJsonlLine(ROW))).toEqual({
      hash: "ba7816bf8f01cfea",
      path: "dataset/audio/budi/clip_0001.wav",
      text: "Halo apa kabar.",
      phonemes: "halo apa kabar.",
      duration: 3.2,
      speaker: "budi",
    });
  });

  it("writes Hugging Face, StyleTTS2, OOD, and PocketTTS lines", () => {
    const hf = JSON.parse(hfMetadataLine(ROW));
    expect(hf.file_name).toBe("audio/budi/clip_0001.wav");
    expect(hf.split).toBe("train");
    expect(styleTts2Line(ROW, "halo apa kabar.")).toBe(
      "audio/budi/clip_0001.wav|halo apa kabar.|0"
    );
    expect(oodLine("halo")).toBe("halo|ood");
    expect(JSON.parse(pocketTtsLine(ROW))).toEqual({
      path: "audio/budi/clip_0001.wav",
      duration: 3.2,
      transcript: "Halo apa kabar.",
      phonemes: "halo apa kabar.",
    });
  });
});

describe("splitFor", () => {
  it("is deterministic per clip id", async () => {
    expect(await splitFor(ROW.clipId)).toBe(await splitFor(ROW.clipId));
  });

  it("sends roughly one clip in twenty to validation", async () => {
    let validation = 0;
    for (let i = 0; i < 2000; i += 1) {
      if ((await splitFor(`clip-${i}`)) === "validation") validation += 1;
    }
    expect(validation).toBeGreaterThan(60);
    expect(validation).toBeLessThan(140);
  });

  it("partitions rows by their split", () => {
    const rows = [ROW, { ...ROW, clipId: "b", split: "validation" as const }];
    const split = partition(rows);
    expect(split.train).toHaveLength(1);
    expect(split.val).toHaveLength(1);
  });
});

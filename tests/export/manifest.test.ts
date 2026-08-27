import { describe, expect, it } from "bun:test";

import type { ExportRow } from "../../src/lib/export/manifest.ts";
import {
  clipFileName,
  hfMetadataLine,
  oodLine,
  pocketTtsLine,
  relativeClipPath,
  speakersJsonlLine,
  splitTrainVal,
  styleTts2Line,
} from "../../src/lib/export/manifest.ts";

const ROW: ExportRow = {
  hash: "ba7816bf8f01cfea",
  path: "dataset/audio/budi/clip_0001.wav",
  relativePath: "audio/budi/clip_0001.wav",
  text: "Halo apa kabar.",
  phonemes: "halo apa kabar.",
  transcript: "Halo apa kabar.",
  durationSec: 3.2004,
  speakerId: "budi",
  speakerIndex: 0,
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
    expect(JSON.parse(hfMetadataLine(ROW)).file_name).toBe("audio/budi/clip_0001.wav");
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

describe("splitTrainVal", () => {
  it("sends every 20th row to validation, deterministically", () => {
    const rows = Array.from({ length: 45 }, (_, i) => i);
    const split = splitTrainVal(rows);
    expect(split.val).toEqual([19, 39]);
    expect(split.train).toHaveLength(43);
  });

  it("keeps at least one validation row when there are two or more rows", () => {
    expect(splitTrainVal([1, 2]).val).toEqual([2]);
    expect(splitTrainVal([1]).val).toEqual([]);
  });
});

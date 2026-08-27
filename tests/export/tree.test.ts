import { describe, expect, it } from "bun:test";

import { datasetTree, renderTree } from "../../src/lib/export/tree.ts";

describe("renderTree", () => {
  it("draws branches, nests children, and aligns notes", () => {
    const lines = renderTree([
      { name: "a", children: [{ name: "b.txt", note: "note" }, { name: "c.txt" }] },
      { name: "d.txt" },
    ]);
    expect(lines).toEqual([
      "├─ a/",
      "│  ├─ b.txt                       note",
      "│  └─ c.txt",
      "└─ d.txt",
    ]);
  });
});

describe("datasetTree", () => {
  it("lists only the files the chosen formats produce", () => {
    const names = renderTree(
      datasetTree({ speakerId: "budi", clipCount: 42, sampleRate: 24000, formats: new Set(["hf"]) })
    ).join("\n");
    expect(names).toContain("dataset/");
    expect(names).toContain("budi/");
    expect(names).toContain("42 berkas WAV mono 16-bit 24.000 Hz");
    expect(names).toContain("metadata.jsonl");
    expect(names).not.toContain("styletts2");
    expect(names).not.toContain("pocket-tts");
    expect(names).toContain("ATTRIBUTION.md");
  });

  it("adds the trainer folders when their formats are on", () => {
    const text = renderTree(
      datasetTree({
        speakerId: "budi",
        clipCount: 1,
        sampleRate: 24000,
        formats: new Set(["styletts2", "pocket-tts"]),
      })
    ).join("\n");
    expect(text).toContain("styletts2/");
    expect(text).toContain("OOD_texts.txt");
    expect(text).toContain("pocket-tts/");
    expect(text).toContain("valid.jsonl");
  });
});

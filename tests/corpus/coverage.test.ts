import { describe, expect, it } from "bun:test";
import type { WordTrace } from "indo-g2p";

import type { Phenomenon } from "../../src/lib/corpus/coverage.ts";
import {
  createUnitTable,
  detectPhenomena,
  englishShare,
  internUnit,
  phoneUnits,
  tokenizePhones,
  unitLabels,
} from "../../src/lib/corpus/coverage.ts";

describe("tokenizePhones", () => {
  it("keeps two-character phones together and drops punctuation", () => {
    expect(tokenizePhones("tʃatʃiŋ")).toEqual(["tʃ", "a", "tʃ", "i", "ŋ"]);
    expect(tokenizePhones("pulaʊ,")).toEqual(["p", "u", "l", "aʊ"]);
    expect(tokenizePhones("dʒadʒan!")).toEqual(["dʒ", "a", "dʒ", "a", "n"]);
  });
});

describe("phoneUnits", () => {
  it("collects phones and boundary-aware diphones per word", () => {
    const units = phoneUnits("taʔ səoraŋ");
    expect(units.phones.has("ʔ")).toBe(true);
    expect(units.phones.has("ə")).toBe(true);
    expect(units.diphones.has("#.t")).toBe(true);
    expect(units.diphones.has("ʔ.#")).toBe(true);
    expect(units.diphones.has("s.ə")).toBe(true);
    expect(units.diphones.has("ʔ.s")).toBe(false);
  });
});

describe("detectPhenomena", () => {
  const traces: WordTrace[] = [
    { word: "download", phonemes: "daʊnlod", source: "english" },
    { word: "apel", phonemes: "apəl", source: "collocation" },
  ];

  it("flags spelling and prosody phenomena from text, phonemes, and traces", () => {
    const found = detectPhenomena(
      "Anak-anak download apel merah 5%!",
      "anaʔ-anaʔ daʊnlod apəl mərah lima pərsen!",
      traces
    );
    const expected: Phenomenon[] = [
      "schwa",
      "glottal",
      "diphthong",
      "number",
      "english",
      "homograph",
      "reduplication",
      "exclamation",
    ];
    for (const phenomenon of expected) expect(found).toContain(phenomenon);
    expect(found).not.toContain("question");
    expect(found).not.toContain("digraph");
  });

  it("flags questions, quotes, commas, and abbreviations", () => {
    const found = detectPhenomena('Apa kabar, Bu, "PT KAI"?', "apa kabar, bu, pt kai?", []);
    expect(found).toEqual(["abbreviation", "question", "commas", "quote"]);
  });
});

describe("englishShare", () => {
  it("is the share of words read as English", () => {
    const traces: WordTrace[] = [
      { word: "we", phonemes: "wi", source: "english" },
      { word: "ask", phonemes: "æsk", source: "english" },
      { word: "prabowo", phonemes: "prabowo", source: "lexicon" },
      { word: "to", phonemes: "tu", source: "english" },
    ];
    expect(englishShare(traces)).toBe(0.75);
    expect(englishShare([])).toBe(0);
  });
});

describe("unitLabels and the unit table", () => {
  it("prefixes and sorts labels, then interns them to stable ids", () => {
    const labels = unitLabels("Nyanyi!", "ɲaɲi!", []);
    expect(labels).toEqual([
      "d:#.ɲ",
      "d:a.ɲ",
      "d:i.#",
      "d:ɲ.a",
      "d:ɲ.i",
      "f:digraph",
      "f:exclamation",
      "p:a",
      "p:i",
      "p:ɲ",
    ]);
    const table = createUnitTable(["p:a"]);
    expect(internUnit(table, "p:a")).toBe(0);
    expect(internUnit(table, "p:i")).toBe(1);
    expect(internUnit(table, "p:a")).toBe(0);
    expect(table.labels).toEqual(["p:a", "p:i"]);
  });
});

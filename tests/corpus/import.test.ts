import { describe, expect, it } from "bun:test";

import { textsFromFile } from "../../src/lib/corpus/import.ts";

describe("textsFromFile", () => {
  it("reads plain text line by line", () => {
    expect(textsFromFile("a.txt", "Satu.\n\n  Dua.  \n")).toEqual(["Satu.", "Dua."]);
  });

  it("reads the sentence column of a Common Voice TSV", () => {
    const tsv = "sentence_id\tsentence\tsource\nid1\tHalo dunia.\tx\nid2\tApa kabar?\ty\n";
    expect(textsFromFile("validated_sentences.tsv", tsv)).toEqual(["Halo dunia.", "Apa kabar?"]);
  });

  it("falls back to the first column when there is no header", () => {
    expect(textsFromFile("x.tsv", "Satu.\tmeta\nDua.\tmeta\n")).toEqual(["Satu.", "Dua."]);
  });

  it("reads text or sentence keys from JSONL and skips bad lines", () => {
    const jsonl = '{"text":"Satu."}\n{"sentence":"Dua."}\nnot json\n{"other":1}\n';
    expect(textsFromFile("x.jsonl", jsonl)).toEqual(["Satu.", "Dua."]);
  });
});

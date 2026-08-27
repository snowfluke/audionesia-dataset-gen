import { describe, expect, it } from "bun:test";

import { packByTotal, splitSentences } from "../../src/lib/corpus/split.ts";

describe("splitSentences", () => {
  it("splits on terminal punctuation followed by a capital", () => {
    expect(splitSentences("Ini kalimat pertama. Ini kedua! Apakah ketiga? Ya.")).toEqual([
      "Ini kalimat pertama.",
      "Ini kedua!",
      "Apakah ketiga?",
      "Ya.",
    ]);
  });

  it("does not split after abbreviations or initials", () => {
    expect(splitSentences("Dr. Budi datang. Ia membawa No. 5 dan A. Rahman.")).toEqual([
      "Dr. Budi datang.",
      "Ia membawa No. 5 dan A. Rahman.",
    ]);
  });

  it("keeps closing quotes with their sentence", () => {
    expect(splitSentences('Ia berkata "Halo." Lalu pergi.')).toEqual([
      'Ia berkata "Halo."',
      "Lalu pergi.",
    ]);
  });

  it("does not split before a lowercase word or inside a number", () => {
    expect(splitSentences("Ia pergi. dan kembali dengan 1.5 juta.")).toEqual([
      "Ia pergi. dan kembali dengan 1.5 juta.",
    ]);
  });

  it("returns the text itself when there is no terminal punctuation", () => {
    expect(splitSentences("tanpa titik")).toEqual(["tanpa titik"]);
    expect(splitSentences("   ")).toEqual([]);
  });
});

describe("packByTotal", () => {
  it("groups consecutive items under the cap and isolates oversized ones", () => {
    const runs = packByTotal([3, 4, 5, 10, 1], (n) => n, 8);
    expect(runs).toEqual([[3, 4], [5], [10], [1]]);
  });

  it("returns no runs for no items", () => {
    expect(packByTotal([], (n: number) => n, 8)).toEqual([]);
  });
});

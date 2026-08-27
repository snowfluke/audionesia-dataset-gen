import { describe, expect, it } from "bun:test";

import { poolSentenceSchema } from "../../src/lib/corpus/schema.ts";
import {
  STYLETTS2_SYMBOLS,
  mapForStyleTts2,
  unknownStyleTts2Symbols,
} from "../../src/lib/export/styletts2-symbols.ts";

describe("StyleTTS2 symbols", () => {
  it("has the 178 symbols of text_utils.py, 177 of them distinct", () => {
    // text_utils.py lists the apostrophe twice (around U+0329), so n_token is
    // 178 while the set of distinct characters is 177.
    expect(STYLETTS2_SYMBOLS.size).toBe(177);
  });

  it("maps hyphens, apostrophes, parentheses, and é", () => {
    expect(mapForStyleTts2("anaʔ-anaʔ (téfé) 'ya'")).toBe("anaʔ anaʔ tefe ya");
  });

  it("accepts every phoneme indo-g2p emits and reports the rest", () => {
    expect(
      unknownStyleTts2Symbols(
        "taʔ səoraŋ pun boleh ditaŋkap, ɲaɲi ʃarat xusus dʒadʒan tʃatʃiŋ pulaʊ pandaɪ ambɔɪ."
      )
    ).toEqual([]);
    expect(unknownStyleTts2Symbols("é ü")).toEqual(["é", "ü"]);
  });

  it("finds no unknown symbol in the bundled pool", async () => {
    const file = Bun.file("public/corpus/pool.jsonl");
    if (!(await file.exists())) return;
    const unknown = new Set<string>();
    for (const line of (await file.text()).split("\n")) {
      if (line.trim() === "") continue;
      const entry = poolSentenceSchema.parse(JSON.parse(line));
      for (const char of unknownStyleTts2Symbols(mapForStyleTts2(entry.phonemes)))
        unknown.add(char);
    }
    expect([...unknown]).toEqual([]);
  });
});

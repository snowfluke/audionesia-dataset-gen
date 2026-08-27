import { describe, expect, it } from "bun:test";

import { normalizeSentence, rejectReason } from "../../src/lib/corpus/filter.ts";
import { textsFromFile } from "../../src/lib/corpus/import.ts";
import { SAMPLE_FILES, SAMPLE_SENTENCES } from "../../src/lib/corpus/sample-text.ts";

describe("sample text", () => {
  it("passes every import filter", () => {
    for (const line of SAMPLE_SENTENCES) {
      expect(rejectReason(normalizeSentence(line))).toBeNull();
    }
  });

  it("imports the same sentences from each sample file format", () => {
    for (const file of SAMPLE_FILES) {
      expect(textsFromFile(file.name, file.content)).toEqual([...SAMPLE_SENTENCES]);
    }
  });
});

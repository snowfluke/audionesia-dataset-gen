import { describe, expect, it } from "bun:test";

import { characterErrorRate, levenshtein, normalizeForCer } from "../../src/lib/text/cer.ts";

describe("normalizeForCer", () => {
  it("drops case, punctuation, and extra spaces", () => {
    expect(normalizeForCer("  Halo, Dunia!  Apa kabar?")).toBe("halo dunia apa kabar");
  });
});

describe("levenshtein", () => {
  it("counts edits", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("sama", "sama")).toBe(0);
  });
});

describe("characterErrorRate", () => {
  it("is zero for a matching transcript regardless of punctuation", () => {
    expect(characterErrorRate("Saya pergi ke pasar.", "saya pergi ke pasar")).toBe(0);
  });

  it("grows with misreads", () => {
    const cer = characterErrorRate("saya pergi ke pasar", "saya pergi ke pasat");
    expect(cer).toBeCloseTo(1 / 19, 5);
    expect(characterErrorRate("saya", "")).toBe(1);
    expect(characterErrorRate("", "")).toBe(0);
  });
});

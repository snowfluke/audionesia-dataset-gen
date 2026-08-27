import { describe, expect, it } from "bun:test";

import {
  DEFAULT_SYLLABLES_PER_SECOND,
  estimateSeconds,
  fitSyllablesPerSecond,
} from "../src/lib/duration.ts";

describe("estimateSeconds", () => {
  it("divides syllables by the rate", () => {
    expect(estimateSeconds(90, 4.5)).toBe(20);
    expect(estimateSeconds(DEFAULT_SYLLABLES_PER_SECOND * 12)).toBeCloseTo(12);
  });

  it("rejects a non-positive rate", () => {
    expect(() => estimateSeconds(10, 0)).toThrow(RangeError);
  });
});

describe("fitSyllablesPerSecond", () => {
  it("fits total syllables over total seconds", () => {
    expect(
      fitSyllablesPerSecond([
        { syllables: 45, durationSec: 10 },
        { syllables: 90, durationSec: 20 },
      ])
    ).toBeCloseTo(4.5);
  });

  it("ignores zero-length clips and returns null with nothing to fit", () => {
    expect(fitSyllablesPerSecond([{ syllables: 10, durationSec: 0 }])).toBeNull();
    expect(fitSyllablesPerSecond([])).toBeNull();
  });
});

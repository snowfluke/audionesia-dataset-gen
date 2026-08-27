import { describe, expect, it } from "bun:test";

import type { BuilderEntry } from "../../src/lib/corpus/script-builder.ts";
import { buildScripts, countUnits } from "../../src/lib/corpus/script-builder.ts";

const UNIT_COUNT = 11;

/** Twenty entries; unit 10 appears only in the last, unit 0 in all of them. */
function pool(): BuilderEntry[] {
  const entries: BuilderEntry[] = [];
  for (let i = 0; i < 20; i += 1) {
    const units = [0, 1 + (i % 5), 6 + (i % 4)];
    if (i === 19) units.push(10);
    entries.push({ id: `s${i}`, syllables: 8 + (i % 3) * 4, units });
  }
  return entries;
}

describe("buildScripts", () => {
  const options = { unitCount: UNIT_COUNT, minSyllables: 30, maxSyllables: 45, scriptCount: 10 };

  it("covers every unit, uses each entry at most once, and respects the window", () => {
    const entries = pool();
    const result = buildScripts(entries, options);
    const used = result.scripts.flatMap((script) => script.sentenceIds);
    expect(new Set(used).size).toBe(used.length);
    for (let unit = 0; unit < UNIT_COUNT; unit += 1) expect(result.unitCounts[unit]).toBeGreaterThan(0);
    for (const script of result.scripts) {
      expect(script.syllables).toBeLessThanOrEqual(options.maxSyllables);
    }
    for (const script of result.scripts.slice(0, -1)) {
      expect(script.syllables).toBeGreaterThanOrEqual(options.minSyllables);
    }
  });

  it("puts the entry with the rare unit into the first script", () => {
    const first = buildScripts(pool(), options).scripts[0];
    expect(first?.sentenceIds).toContain("s19");
  });

  it("stops at scriptCount and keeps a short tail script when the pool runs dry", () => {
    expect(buildScripts(pool(), { ...options, scriptCount: 2 }).scripts).toHaveLength(2);
    const all = buildScripts(pool(), { ...options, scriptCount: 100 }).scripts;
    expect(all.flatMap((script) => script.sentenceIds)).toHaveLength(20);
    const tail = all[all.length - 1];
    expect(tail?.syllables).toBeGreaterThan(0);
  });

  it("returns nothing for an empty pool", () => {
    expect(buildScripts([], options).scripts).toEqual([]);
  });
});

describe("countUnits", () => {
  it("counts occurrences per unit", () => {
    const counts = countUnits(pool(), UNIT_COUNT);
    expect(counts[0]).toBe(20);
    expect(counts[10]).toBe(1);
  });
});

import { describe, expect, it } from "bun:test";

import type { BuilderEntry } from "../../src/lib/corpus/script-builder.ts";
import { buildScripts, countUnits } from "../../src/lib/corpus/script-builder.ts";

const UNIT_COUNT = 11;

/** Twenty entries from one source; unit 10 appears only in the last, unit 0 in all of them. */
function pool(source = "a"): BuilderEntry[] {
  const entries: BuilderEntry[] = [];
  for (let i = 0; i < 20; i += 1) {
    const units = [0, 1 + (i % 5), 6 + (i % 4)];
    if (i === 19) units.push(10);
    entries.push({ id: `${source}${i}`, syllables: 8 + (i % 3) * 4, units, source });
  }
  return entries;
}

const options = { unitCount: UNIT_COUNT, minSyllables: 30, maxSyllables: 45, scriptCount: 10 };

describe("buildScripts", () => {
  it("covers every unit, uses each entry at most once, and respects the window", () => {
    const result = buildScripts(pool(), options);
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
    expect(first?.sentenceIds).toContain("a19");
  });

  it("stops at scriptCount and keeps a short tail script when the pool runs dry", () => {
    expect(buildScripts(pool(), { ...options, scriptCount: 2 }).scripts).toHaveLength(2);
    const all = buildScripts(pool(), { ...options, scriptCount: 100 }).scripts;
    expect(all.flatMap((script) => script.sentenceIds)).toHaveLength(20);
    expect(all[all.length - 1]?.syllables).toBeGreaterThan(0);
  });

  it("keeps a script within its lead's source when the sources are equally useful", () => {
    const entries = [...pool("a"), ...pool("b")];
    const result = buildScripts(entries, { ...options, sourceWeights: new Map(), sameSourceTolerance: 0 });
    for (const script of result.scripts) {
      const sources = new Set(script.sentenceIds.map((id) => id.charAt(0)));
      expect(sources.size).toBe(1);
    }
  });

  it("lets a weighted source lead the first script", () => {
    const entries = [...pool("a"), ...pool("b")];
    const first = buildScripts(entries, { ...options, sourceWeights: new Map([["b", 2]]) }).scripts[0];
    expect(first?.sentenceIds.every((id) => id.startsWith("b"))).toBe(true);
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

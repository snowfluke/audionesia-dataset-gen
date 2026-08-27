/** What the builder needs to know about one pool entry. */
export type BuilderEntry = {
  id: string;
  syllables: number;
  units: readonly number[];
  /** Corpus source; scripts prefer to stay within one source so they read as one voice. */
  source: string;
};

export type BuilderOptions = {
  unitCount: number;
  minSyllables: number;
  maxSyllables: number;
  /** Stop after this many scripts; the pool may run dry first. */
  scriptCount: number;
  /** Gain multiplier per source. Paragraph sources read more naturally than one-liners. */
  sourceWeights?: ReadonlyMap<string, number>;
  /**
   * While filling a script, an entry from the script's own source wins as long
   * as its gain is at least this share of the best entry from any other source.
   */
  sameSourceTolerance?: number;
};

export type ScriptDraft = { sentenceIds: string[]; syllables: number; gain: number };

export type BuildResult = {
  scripts: ScriptDraft[];
  /** How many times each unit occurs across the built scripts. */
  unitCounts: Uint32Array;
};

export const DEFAULT_SOURCE_WEIGHTS: ReadonlyMap<string, number> = new Map([
  ["wikipedia", 1.4],
  ["news", 1.6],
  ["llm", 1.6],
]);
export const DEFAULT_SAME_SOURCE_TOLERANCE = 0;

/**
 * Short fragments are charged at least this many syllables, so a script is
 * not stitched from one-line exclamations that happen to carry a rare sound.
 */
const MIN_COST_SYLLABLES = 16;

type HeapItem = { index: number; bound: number };

/** Binary max-heap on `bound`. Small enough to live here. */
function pushHeap(heap: HeapItem[], item: HeapItem): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    const current = heap[i];
    const above = heap[parent];
    if (current === undefined || above === undefined || above.bound >= current.bound) break;
    heap[i] = above;
    heap[parent] = current;
    i = parent;
  }
}

function popHeap(heap: HeapItem[]): HeapItem | undefined {
  const top = heap[0];
  const last = heap.pop();
  if (top === undefined || last === undefined || heap.length === 0) return top;
  heap[0] = last;
  let i = 0;
  for (;;) {
    const left = 2 * i + 1;
    const right = left + 1;
    let largest = i;
    const leftItem = heap[left];
    if (leftItem !== undefined && leftItem.bound > (heap[largest]?.bound ?? -Infinity)) largest = left;
    const rightItem = heap[right];
    if (rightItem !== undefined && rightItem.bound > (heap[largest]?.bound ?? -Infinity)) largest = right;
    if (largest === i) break;
    const swap = heap[largest];
    const current = heap[i];
    if (swap === undefined || current === undefined) break;
    heap[largest] = current;
    heap[i] = swap;
    i = largest;
  }
  return top;
}

/**
 * Value of an entry given what the scripts so far already cover. Each unit is
 * worth its rarity in the pool (1 / log2 of its pool frequency) divided by
 * 1 + the times it is already covered, and the sum is divided by the
 * syllables it costs to read. Rare sounds therefore surface early, which
 * matters when recording stops long before the pool is exhausted, without a
 * one-off foreign name outweighing everything else. The value only falls as
 * coverage grows, so lazy re-evaluation is exact.
 */
function scoreEntry(entry: BuilderEntry, weights: Float64Array, unitCounts: Uint32Array): number {
  let total = 0;
  for (const unit of entry.units) total += (weights[unit] ?? 0) / (1 + (unitCounts[unit] ?? 0));
  return total / Math.max(MIN_COST_SYLLABLES, entry.syllables);
}

function rarityWeights(entries: readonly BuilderEntry[], unitCount: number): Float64Array {
  const frequency = countUnits(entries, unitCount);
  const weights = new Float64Array(unitCount);
  for (let unit = 0; unit < unitCount; unit += 1) {
    const count = frequency[unit] ?? 0;
    weights[unit] = count === 0 ? 0 : 1 / Math.log2(2 + count);
  }
  return weights;
}

/** Brings the top of a heap up to date. Gains only fall, so an exact top is the true maximum. */
function settle(heap: HeapItem[], gainOf: (index: number) => number): HeapItem | undefined {
  for (;;) {
    const top = heap[0];
    if (top === undefined) return undefined;
    const fresh = gainOf(top.index);
    if (fresh === top.bound) return top;
    popHeap(heap);
    pushHeap(heap, { index: top.index, bound: fresh });
  }
}

type Choice = { source: string; item: HeapItem };

/**
 * Greedy set cover with lazy updates and one heap per source. A script opens
 * with the best entry overall, then keeps drawing from its own source while
 * that source's best entry is worth at least `sameSourceTolerance` of the best
 * elsewhere. The default of 0 never mixes sources inside one script; the
 * next script still opens with the best entry of any source, so coverage
 * is only delayed, not lost. The script closes at `minSyllables`; an entry that would push it
 * past `maxSyllables` closes it first. The last script may fall short when
 * the pool runs dry.
 */
export function buildScripts(entries: readonly BuilderEntry[], options: BuilderOptions): BuildResult {
  const unitCounts = new Uint32Array(options.unitCount);
  const weights = rarityWeights(entries, options.unitCount);
  const sourceWeights = options.sourceWeights ?? DEFAULT_SOURCE_WEIGHTS;
  const tolerance = options.sameSourceTolerance ?? DEFAULT_SAME_SOURCE_TOLERANCE;
  const gainOf = (index: number): number => {
    const entry = entries[index];
    if (entry === undefined) return 0;
    return scoreEntry(entry, weights, unitCounts) * (sourceWeights.get(entry.source) ?? 1);
  };

  const heaps = new Map<string, HeapItem[]>();
  entries.forEach((entry, index) => {
    const heap = heaps.get(entry.source) ?? [];
    heaps.set(entry.source, heap);
    pushHeap(heap, { index, bound: gainOf(index) });
  });

  const bestExcept = (excluded: string | null): Choice | undefined => {
    let best: Choice | undefined;
    for (const [source, heap] of heaps) {
      if (source === excluded) continue;
      const item = settle(heap, gainOf);
      if (item !== undefined && (best === undefined || item.bound > best.item.bound)) {
        best = { source, item };
      }
    }
    return best;
  };

  const scripts: ScriptDraft[] = [];
  let open: ScriptDraft = { sentenceIds: [], syllables: 0, gain: 0 };
  let openSource: string | null = null;
  const close = (): void => {
    if (open.sentenceIds.length > 0) scripts.push(open);
    open = { sentenceIds: [], syllables: 0, gain: 0 };
    openSource = null;
  };

  while (scripts.length < options.scriptCount) {
    let choice: Choice | undefined;
    if (openSource === null) {
      choice = bestExcept(null);
    } else {
      const heap = heaps.get(openSource);
      const same = heap === undefined ? undefined : settle(heap, gainOf);
      if (same === undefined) {
        // The script's source ran dry: close it rather than pad it from elsewhere.
        close();
        if (scripts.length >= options.scriptCount) break;
        choice = bestExcept(null);
      } else {
        const other = bestExcept(openSource);
        const keepSource = other === undefined || same.bound >= tolerance * other.item.bound;
        choice = keepSource ? { source: openSource, item: same } : other;
      }
    }
    if (choice === undefined) break;
    const heap = heaps.get(choice.source);
    const entry = entries[choice.item.index];
    if (heap === undefined || entry === undefined) break;
    popHeap(heap);
    if (open.syllables > 0 && open.syllables + entry.syllables > options.maxSyllables) {
      close();
      if (scripts.length >= options.scriptCount) {
        pushHeap(heap, choice.item);
        break;
      }
    }
    openSource ??= entry.source;
    open.sentenceIds.push(entry.id);
    open.syllables += entry.syllables;
    open.gain += choice.item.bound;
    for (const unit of entry.units) unitCounts[unit] = (unitCounts[unit] ?? 0) + 1;
    if (open.syllables >= options.minSyllables) close();
  }
  if (scripts.length < options.scriptCount) close();

  return { scripts, unitCounts };
}

/** Occurrences of every unit across a set of entries, for coverage displays. */
export function countUnits(entries: readonly BuilderEntry[], unitCount: number): Uint32Array {
  const counts = new Uint32Array(unitCount);
  for (const entry of entries) {
    for (const unit of entry.units) counts[unit] = (counts[unit] ?? 0) + 1;
  }
  return counts;
}

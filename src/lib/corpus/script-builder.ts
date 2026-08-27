/** What the builder needs to know about one pool entry. */
export type BuilderEntry = { id: string; syllables: number; units: readonly number[] };

export type BuilderOptions = {
  unitCount: number;
  minSyllables: number;
  maxSyllables: number;
  /** Stop after this many scripts; the pool may run dry first. */
  scriptCount: number;
};

export type ScriptDraft = { sentenceIds: string[]; syllables: number; gain: number };

export type BuildResult = {
  scripts: ScriptDraft[];
  /** How many times each unit occurs across the built scripts. */
  unitCounts: Uint32Array;
};

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
  if (top === undefined || last === undefined) return top;
  if (heap.length === 0) return top;
  heap[0] = last;
  let i = 0;
  for (;;) {
    const left = 2 * i + 1;
    const right = left + 1;
    let largest = i;
    const leftItem = heap[left];
    const rightItem = heap[right];
    const largestItem = heap[largest];
    if (leftItem !== undefined && largestItem !== undefined && leftItem.bound > largestItem.bound) largest = left;
    const largestNow = heap[largest];
    if (rightItem !== undefined && largestNow !== undefined && rightItem.bound > largestNow.bound) largest = right;
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
 * worth its rarity in the pool (1 / pool frequency) divided by 1 + the times
 * it is already covered, and the sum is divided by the syllables it costs to
 * read. Rare sounds therefore surface early, which matters when recording
 * stops long before the pool is exhausted. The value only falls as coverage
 * grows, so lazy re-evaluation is exact.
 */
function scoreEntry(entry: BuilderEntry, weights: Float64Array, unitCounts: Uint32Array): number {
  let total = 0;
  for (const unit of entry.units) total += (weights[unit] ?? 0) / (1 + (unitCounts[unit] ?? 0));
  return total / Math.max(1, entry.syllables);
}

function rarityWeights(entries: readonly BuilderEntry[], unitCount: number): Float64Array {
  const frequency = countUnits(entries, unitCount);
  const weights = new Float64Array(unitCount);
  for (let unit = 0; unit < unitCount; unit += 1) {
    const count = frequency[unit] ?? 0;
    weights[unit] = count === 0 ? 0 : 1 / count;
  }
  return weights;
}

/**
 * Greedy set cover with lazy updates. Picks the entry with the best coverage
 * gain per syllable, appends it to the open script, and closes the script once
 * it reaches `minSyllables`. An entry that would push the script past
 * `maxSyllables` closes the script first and starts the next one. The last
 * script may fall short of `minSyllables` when the pool runs dry.
 */
export function buildScripts(entries: readonly BuilderEntry[], options: BuilderOptions): BuildResult {
  const unitCounts = new Uint32Array(options.unitCount);
  const weights = rarityWeights(entries, options.unitCount);
  const gainOf = (entry: BuilderEntry): number => scoreEntry(entry, weights, unitCounts);
  const heap: HeapItem[] = [];
  entries.forEach((entry, index) => pushHeap(heap, { index, bound: gainOf(entry) }));

  const scripts: ScriptDraft[] = [];
  let open: ScriptDraft = { sentenceIds: [], syllables: 0, gain: 0 };

  const close = (): void => {
    if (open.sentenceIds.length > 0) scripts.push(open);
    open = { sentenceIds: [], syllables: 0, gain: 0 };
  };

  while (scripts.length < options.scriptCount) {
    const top = popHeap(heap);
    if (top === undefined) break;
    const entry = entries[top.index];
    if (entry === undefined) continue;
    const gain = gainOf(entry);
    const next = heap[0];
    if (next !== undefined && gain < next.bound) {
      pushHeap(heap, { index: top.index, bound: gain });
      continue;
    }
    if (open.syllables > 0 && open.syllables + entry.syllables > options.maxSyllables) close();
    if (scripts.length >= options.scriptCount) {
      pushHeap(heap, { index: top.index, bound: gain });
      break;
    }
    open.sentenceIds.push(entry.id);
    open.syllables += entry.syllables;
    open.gain += gain;
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

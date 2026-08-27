// Asks Claude for Indonesian paragraphs that exercise the least-covered units of the
// current pool. Usage: bun run corpus:llm [batches]   (default 5, 10 paragraphs each).
// Needs ANTHROPIC_API_KEY or an `ant auth login` profile. Runs accumulate in
// corpus/raw/llm.jsonl; rebuild the pool afterwards with `bun run corpus:build`.
import Anthropic from "@anthropic-ai/sdk";
import { toGrapheme } from "indo-g2p";

import type { RawSentence } from "../../src/lib/corpus/schema.ts";
import { poolIndexSchema, poolSentenceSchema, rawSentenceSchema } from "../../src/lib/corpus/schema.ts";
import { PUBLIC_DIR, RAW_DIR, writeJsonl } from "./shared.ts";

const MODEL = "claude-opus-5";
const PARAGRAPHS_PER_BATCH = 10;
const TARGETS_PER_BATCH = 24;
const MIN_WORDS = 40;
const MAX_WORDS = 120;
/** Anthropic list price for the model above, USD per million tokens. */
const PRICE_INPUT = 5;
const PRICE_OUTPUT = 25;

const PHENOMENON_HINTS = new Map<string, string>([
  ["schwa", "words with the pepet e (as in sekolah, kena, terus)"],
  ["glottal", "words ending in k or with k before a consonant (tidak, rakyat)"],
  ["digraph", "the digraphs ng, ny, sy, kh (bangun, nyanyi, syarat, akhir)"],
  ["diphthong", "the diphthongs ai, au, oi (pandai, pulau, amboi)"],
  ["number", "a number written in digits, a price in rupiah, or a percentage"],
  ["english", "an English loanword common in Indonesian (download, event, update)"],
  ["homograph", "the word apel in both senses, or another homograph"],
  ["reduplication", "a hyphenated reduplication (anak-anak, buku-buku)"],
  ["abbreviation", "a spoken abbreviation such as PT, RT, or TNI"],
  ["question", "a question"],
  ["exclamation", "an exclamation"],
  ["commas", "a long sentence with several commas"],
  ["quote", "a quoted line of dialogue"],
]);

const SYSTEM_PROMPT = `You write Indonesian reading scripts for a text-to-speech training corpus.

Rules for every paragraph:
- Natural, standard Bahasa Indonesia (PUEBI spelling). Formal or conversational register, varied topics: daily life, news, science, history, cooking, travel, dialogue.
- ${MIN_WORDS} to ${MAX_WORDS} words, 2 to 5 sentences, self-contained, pleasant to read aloud.
- Plain text only: no headings, lists, numbering, markdown, quotation of sources, or English explanations.
- Use only ASCII letters and punctuation. Digits and percentages are allowed when a target asks for them.
- Each paragraph must contain several of the requested targets, spread across the batch so every target appears at least once.
- Separate paragraphs with one blank line. Output nothing else.`;

function describeUnit(label: string): string | null {
  const kind = label.slice(0, 2);
  const body = label.slice(2);
  if (kind === "p:") return `the sound /${body}/ (spelled "${toGrapheme(body)}")`;
  if (kind === "f:") return PHENOMENON_HINTS.get(body) ?? null;
  if (kind !== "d:") return null;
  const [first, second] = body.split(".");
  if (first === undefined || second === undefined) return null;
  if (first === "#") return `a word starting with /${second}/ (spelled "${toGrapheme(second)}")`;
  if (second === "#") return `a word ending with /${first}/ (spelled "${toGrapheme(first)}")`;
  return `the sequence /${first}${second}/ (spelled "${toGrapheme(first + second)}")`;
}

async function leastCoveredTargets(count: number): Promise<string[]> {
  const index = poolIndexSchema.parse(await Bun.file(`${PUBLIC_DIR}/index.json`).json());
  const counts = new Array<number>(index.units.length).fill(0);
  for (const line of (await Bun.file(`${PUBLIC_DIR}/pool.jsonl`).text()).split("\n")) {
    if (line.trim() === "") continue;
    const entry = poolSentenceSchema.parse(JSON.parse(line));
    for (const unit of entry.units) counts[unit] = (counts[unit] ?? 0) + 1;
  }
  const ranked = index.units
    .map((label, id) => ({ label, count: counts[id] ?? 0 }))
    .sort((a, b) => a.count - b.count);
  const targets: string[] = [];
  for (const unit of ranked) {
    const description = describeUnit(unit.label);
    if (description !== null) targets.push(description);
    if (targets.length === count) break;
  }
  return targets;
}

function paragraphsOf(text: string): string[] {
  const found: string[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const paragraph = block.replace(/\s+/g, " ").trim();
    const words = paragraph.split(" ").length;
    if (words < MIN_WORDS || words > MAX_WORDS) continue;
    if (/^[-*#\d]/.test(paragraph)) continue;
    found.push(paragraph);
  }
  return found;
}

async function readExisting(target: string): Promise<Map<string, RawSentence>> {
  const rows = new Map<string, RawSentence>();
  const file = Bun.file(target);
  if (!(await file.exists())) return rows;
  for (const line of (await file.text()).split("\n")) {
    if (line.trim() === "") continue;
    const parsed = rawSentenceSchema.safeParse(JSON.parse(line));
    if (parsed.success) rows.set(parsed.data.text, parsed.data);
  }
  return rows;
}

const batches = Number.parseInt(process.argv[2] ?? "5", 10);
if (!Number.isFinite(batches) || batches <= 0) {
  console.error("usage: bun run corpus:llm [batches]");
  process.exit(1);
}

const target = `${RAW_DIR}/llm.jsonl`;
const rows = await readExisting(target);
const before = rows.size;
const client = new Anthropic();
let inputTokens = 0;
let outputTokens = 0;

for (let batch = 0; batch < batches; batch += 1) {
  const targets = await leastCoveredTargets(TARGETS_PER_BATCH);
  const request = `Write ${PARAGRAPHS_PER_BATCH} paragraphs. Targets to cover across the batch:\n${targets
    .map((line) => `- ${line}`)
    .join("\n")}`;
  // Server-side refusal fallbacks are on: a policy decline re-runs the request on a fallback model.
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    cache_control: { type: "ephemeral" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: request }],
  });
  const message = await stream.finalMessage();
  inputTokens += message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0);
  outputTokens += message.usage.output_tokens;
  if (message.stop_reason === "refusal") {
    console.warn(`batch ${batch + 1}: refused (${message.stop_details?.category ?? "unknown"})`);
    continue;
  }
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
  let added = 0;
  for (const paragraph of paragraphsOf(text)) {
    if (rows.has(paragraph)) continue;
    rows.set(paragraph, { text: paragraph, source: "llm", license: "CC0-1.0" });
    added += 1;
  }
  console.log(`batch ${batch + 1}/${batches}: ${added} paragraphs`);
}

await writeJsonl(target, [...rows.values()]);
const cost = (inputTokens * PRICE_INPUT + outputTokens * PRICE_OUTPUT) / 1_000_000;
console.log(
  `wrote ${rows.size - before} new paragraphs (${rows.size} total) to ${target}; ` +
    `${inputTokens} in / ${outputTokens} out tokens, about $${cost.toFixed(3)}`
);

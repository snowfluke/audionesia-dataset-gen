// Pulls random article introductions from Wikipedia bahasa Indonesia (CC-BY-SA-4.0).
// Usage: bun run corpus:wikipedia [pages]   (default 500). Runs accumulate.
import { z } from "zod";

import type { RawSentence } from "../../src/lib/corpus/schema.ts";
import { rawSentenceSchema } from "../../src/lib/corpus/schema.ts";
import { RAW_DIR, download, writeJsonl } from "./shared.ts";

const API_URL = "https://id.wikipedia.org/w/api.php";
const PAGES_PER_REQUEST = 20;
const MIN_PARAGRAPH_CHARS = 80;
const PAUSE_MS = 250;
const USER_AGENT = "audionesia-dataset-gen/0.1 (TTS corpus builder; bun)";

const responseSchema = z.object({
  query: z
    .object({
      pages: z.array(z.object({ title: z.string(), extract: z.string().optional() })),
    })
    .optional(),
});

const target = `${RAW_DIR}/wikipedia.jsonl`;
const wanted = Number.parseInt(process.argv[2] ?? "500", 10);
if (!Number.isFinite(wanted) || wanted <= 0) {
  console.error("usage: bun run corpus:wikipedia [pages]");
  process.exit(1);
}

async function readExisting(): Promise<Map<string, RawSentence>> {
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

function articleUrl(title: string): string {
  return `https://id.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

const rows = await readExisting();
const before = rows.size;
let fetched = 0;
while (fetched < wanted) {
  const params = new URLSearchParams({
    action: "query",
    generator: "random",
    grnnamespace: "0",
    grnlimit: String(PAGES_PER_REQUEST),
    prop: "extracts",
    explaintext: "1",
    exintro: "1",
    exlimit: String(PAGES_PER_REQUEST),
    format: "json",
    formatversion: "2",
  });
  const response = await download(`${API_URL}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  const body = responseSchema.parse(await response.json());
  for (const page of body.query?.pages ?? []) {
    fetched += 1;
    for (const paragraph of (page.extract ?? "").split(/\n+/)) {
      const text = paragraph.trim();
      if (text.length < MIN_PARAGRAPH_CHARS || rows.has(text)) continue;
      // Language-template residue ("code: en is deprecated") is markup, not prose.
      if (/code:\s*[a-z]{2}\b|is deprecated|\{\{|\}\}/.test(text)) continue;
      rows.set(text, {
        text,
        source: "wikipedia",
        license: "CC-BY-SA-4.0",
        attribution: `Wikipedia bahasa Indonesia, "${page.title}", ${articleUrl(page.title)}`,
      });
    }
  }
  await Bun.sleep(PAUSE_MS);
}

await writeJsonl(target, [...rows.values()]);
console.log(`fetched ${fetched} pages; ${rows.size - before} new paragraphs; ${rows.size} total in ${target}`);

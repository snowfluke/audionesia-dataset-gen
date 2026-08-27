// Collects article paragraphs from the feeds and URLs listed in corpus/sources.json.
// Article text is read through `ax <url> --md`, so each site needs no selector.
import { $ } from "bun";
import { z } from "zod";

import type { RawSentence } from "../../src/lib/corpus/schema.ts";
import { RAW_DIR, download, writeJsonl } from "./shared.ts";

const SOURCES_FILE = "corpus/sources.json";
const MIN_PARAGRAPH_CHARS = 80;
const PAUSE_MS = 500;

const sourceSchema = z.object({
  name: z.string().min(1),
  license: z.string().min(1),
  maxArticles: z.number().int().positive().default(50),
  feeds: z.array(z.string().url()).default([]),
  urls: z.array(z.string().url()).default([]),
});
type NewsSource = z.infer<typeof sourceSchema>;

/** RSS is XML, not HTML, so `ax` selectors do not apply; the item links are read directly. */
function feedLinks(xml: string): string[] {
  const links: string[] = [];
  for (const match of xml.matchAll(/<item>[\s\S]*?<link>\s*([^<\s]+)\s*<\/link>/g)) {
    const link = match[1];
    if (link !== undefined) links.push(link);
  }
  return links;
}

async function articleUrls(source: NewsSource): Promise<string[]> {
  const urls = new Set<string>(source.urls);
  for (const feed of source.feeds) {
    try {
      const xml = await (await download(feed)).text();
      for (const link of feedLinks(xml)) urls.add(link);
    } catch (error: unknown) {
      console.warn(`skip feed ${feed}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return [...urls].slice(0, source.maxArticles);
}

/** Prose lines of a markdown page: long, not a heading, list, quote, table, or code. */
function paragraphs(markdown: string): string[] {
  const found: string[] = [];
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .trim();
    if (line.length < MIN_PARAGRAPH_CHARS) continue;
    if (/^([#\-*>|`]|\d+\.)/.test(line)) continue;
    found.push(line);
  }
  return found;
}

// Usage: bun run corpus:news [maxArticles]   (overrides every source's maxArticles)
const override = process.argv[2] === undefined ? null : Number.parseInt(process.argv[2], 10);
const sources = z.array(sourceSchema).parse(await Bun.file(SOURCES_FILE).json());
const rows: RawSentence[] = [];
for (const source of sources) {
  const urls = await articleUrls(
    override === null || Number.isNaN(override) ? source : { ...source, maxArticles: override }
  );
  console.log(`${source.name}: ${urls.length} articles`);
  for (const url of urls) {
    try {
      const markdown = await $`ax ${url} --md --all`.quiet().text();
      for (const text of paragraphs(markdown)) {
        rows.push({ text, source: "news", license: source.license, attribution: `${source.name}, ${url}` });
      }
    } catch (error: unknown) {
      console.warn(`skip ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await Bun.sleep(PAUSE_MS);
  }
}

const target = `${RAW_DIR}/news.jsonl`;
await writeJsonl(target, rows);
console.log(`wrote ${rows.length} paragraphs to ${target}`);

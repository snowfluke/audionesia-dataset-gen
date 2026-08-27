import type { PoolIndex } from "./schema.ts";
import { SOURCE_INFO } from "./sources.ts";

/** The `ATTRIBUTION.md` that ships next to a corpus or a dataset. */
export function attributionMarkdown(sources: PoolIndex["sources"]): string {
  const lines = ["# Attribution", "", "Text sources of this corpus and the terms each carries.", ""];
  for (const summary of sources) {
    const info = SOURCE_INFO.get(summary.source);
    lines.push(`## ${info?.name ?? summary.source}`, "");
    lines.push(`- License: ${summary.license}`);
    lines.push(`- Entries: ${summary.count}`);
    if (info !== undefined) {
      if (info.url !== "") lines.push(`- Origin: ${info.url}`);
      lines.push(`- Attribution: ${info.attribution}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

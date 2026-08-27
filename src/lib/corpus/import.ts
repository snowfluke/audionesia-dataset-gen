import { z } from "zod";

const jsonlRowSchema = z.union([
  z.object({ text: z.string() }),
  z.object({ sentence: z.string() }),
]);

function fromJsonl(content: string): string[] {
  const texts: string[] = [];
  for (const line of content.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const parsed = jsonlRowSchema.safeParse(JSON.parse(line));
      if (!parsed.success) continue;
      texts.push("text" in parsed.data ? parsed.data.text : parsed.data.sentence);
    } catch {
      // Not JSON; skip the line.
    }
  }
  return texts;
}

/** TSV with a `sentence` column (Common Voice `validated_sentences.tsv`), else the first column. */
function fromTsv(content: string): string[] {
  const lines = content.split("\n").filter((line) => line.trim() !== "");
  const header = lines[0]?.split("\t") ?? [];
  const named = header.findIndex((column) => column.trim().toLowerCase() === "sentence");
  const column = named === -1 ? 0 : named;
  const rows = named === -1 ? lines : lines.slice(1);
  return rows.map((line) => line.split("\t")[column] ?? "").filter((text) => text !== "");
}

/** Extracts candidate sentences from a dropped file, by extension. */
export function textsFromFile(fileName: string, content: string): string[] {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (extension === "jsonl" || extension === "json") return fromJsonl(content);
  if (extension === "tsv" || extension === "csv") return fromTsv(content);
  return content.split("\n").map((line) => line.trim()).filter((line) => line !== "");
}

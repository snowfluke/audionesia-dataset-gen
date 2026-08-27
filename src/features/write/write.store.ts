import { createSignal } from "solid-js";

import { showToast } from "../../components/toast.tsx";
import { FOREIGN_SHARE } from "../../lib/corpus/coverage.ts";
import type { RejectReason } from "../../lib/corpus/filter.ts";
import { dedupKey, normalizeSentence, rejectReason } from "../../lib/corpus/filter.ts";
import { textsFromFile } from "../../lib/corpus/import.ts";
import { phonemize } from "../../lib/g2p/client.ts";
import type { Phonemized } from "../../lib/g2p/messages.ts";
import { addUserSentences, rebuildScripts } from "../library/library.store.ts";

const PHONEMIZE_BATCH = 500;

export type WritePhase = "editing" | "analyzing" | "previewing" | "saving";

export type RejectedLine = { line: string; reason: RejectReason | "duplicate" | "foreign" };

export const REJECT_LABELS = {
  "too-short": "terlalu pendek",
  "too-few-words": "kurang dari 4 kata",
  "too-long": "terlalu panjang",
  "non-ascii": "memuat huruf non-Latin",
  markup: "memuat tanda markup",
  url: "memuat alamat web",
  "no-letters": "hampir tanpa huruf",
  "too-many-digits": "terlalu banyak angka",
  "too-many-capitals": "terlalu banyak huruf kapital",
  duplicate: "duplikat di dalam teks ini",
  foreign: "sebagian besar kata dibaca sebagai bahasa Inggris",
} as const satisfies Record<RejectedLine["reason"], string>;

export type WriteStore = {
  text: () => string;
  setText: (value: string) => void;
  phase: () => WritePhase;
  preview: () => Phonemized[];
  rejected: () => RejectedLine[];
  analyze: () => Promise<void>;
  commit: (rebuild: boolean) => Promise<void>;
  addFiles: (files: FileList | File[]) => Promise<void>;
  discard: () => void;
};

/** Call inside the Tulis view. */
export function createWriteStore(): WriteStore {
  const [text, setText] = createSignal("");
  const [phase, setPhase] = createSignal<WritePhase>("editing");
  const [preview, setPreview] = createSignal<Phonemized[]>([]);
  const [rejected, setRejected] = createSignal<RejectedLine[]>([]);
  const [g2pVersion, setG2pVersion] = createSignal("");

  function candidates(): string[] {
    const seen = new Set<string>();
    const accepted: string[] = [];
    const dropped: RejectedLine[] = [];
    for (const line of text().split("\n")) {
      const sentence = normalizeSentence(line);
      if (sentence === "") continue;
      const reason = rejectReason(sentence);
      const key = dedupKey(sentence);
      if (reason !== null) dropped.push({ line: sentence, reason });
      else if (seen.has(key)) dropped.push({ line: sentence, reason: "duplicate" });
      else {
        seen.add(key);
        accepted.push(sentence);
      }
    }
    setRejected(dropped);
    return accepted;
  }

  async function analyze(): Promise<void> {
    const sentences = candidates();
    if (sentences.length === 0) {
      showToast("Tidak ada kalimat yang bisa dipakai", "error");
      return;
    }
    setPhase("analyzing");
    try {
      const results: Phonemized[] = [];
      const foreign: RejectedLine[] = [];
      for (let start = 0; start < sentences.length; start += PHONEMIZE_BATCH) {
        const response = await phonemize(sentences.slice(start, start + PHONEMIZE_BATCH));
        for (const result of response.results) {
          if (result.englishShare >= FOREIGN_SHARE)
            foreign.push({ line: result.text, reason: "foreign" });
          else results.push(result);
        }
        setG2pVersion(response.g2pVersion);
      }
      setRejected((current) => [...current, ...foreign]);
      setPreview(results);
      setPhase("previewing");
    } catch (cause: unknown) {
      setPhase("editing");
      throw cause;
    }
  }

  async function commit(rebuild: boolean): Promise<void> {
    if (phase() !== "previewing") return;
    setPhase("saving");
    try {
      const result = await addUserSentences(preview(), g2pVersion());
      const note =
        result.duplicates > 0
          ? `, ${result.duplicates.toLocaleString("id-ID")} sudah ada di kumpulan`
          : "";
      showToast(`${result.added.toLocaleString("id-ID")} kalimat ditambahkan${note}`, "success");
      if (rebuild) {
        const count = await rebuildScripts();
        showToast(`${count.toLocaleString("id-ID")} naskah disusun ulang`, "success");
      }
      setText("");
      setPreview([]);
      setRejected([]);
    } finally {
      setPhase("editing");
    }
  }

  async function addFiles(files: FileList | File[]): Promise<void> {
    const lines: string[] = [];
    for (const file of files) lines.push(...textsFromFile(file.name, await file.text()));
    setText((current) =>
      current.trim() === "" ? lines.join("\n") : `${current}\n${lines.join("\n")}`
    );
    showToast(`${lines.length.toLocaleString("id-ID")} baris dimuat dari berkas`);
  }

  function discard(): void {
    setPreview([]);
    setPhase("editing");
  }

  return { text, setText, phase, preview, rejected, analyze, commit, addFiles, discard };
}

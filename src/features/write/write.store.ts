import { createSignal } from "solid-js";

import { showToast } from "../../components/toast.tsx";
import { dedupKey, normalizeSentence, rejectReason } from "../../lib/corpus/filter.ts";
import { textsFromFile } from "../../lib/corpus/import.ts";
import { phonemize } from "../../lib/g2p/client.ts";
import type { Phonemized } from "../../lib/g2p/messages.ts";
import { addUserSentences, rebuildScripts } from "../library/library.store.ts";

const PHONEMIZE_BATCH = 500;

export type WritePhase = "editing" | "analyzing" | "previewing" | "saving";

export type WriteStore = {
  text: () => string;
  setText: (value: string) => void;
  phase: () => WritePhase;
  preview: () => Phonemized[];
  rejected: () => number;
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
  const [rejected, setRejected] = createSignal(0);
  const [g2pVersion, setG2pVersion] = createSignal("");

  function candidates(): string[] {
    const seen = new Set<string>();
    const accepted: string[] = [];
    let dropped = 0;
    for (const line of text().split("\n")) {
      const sentence = normalizeSentence(line);
      if (sentence === "") continue;
      const key = dedupKey(sentence);
      if (rejectReason(sentence) !== null || seen.has(key)) {
        dropped += 1;
        continue;
      }
      seen.add(key);
      accepted.push(sentence);
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
      for (let start = 0; start < sentences.length; start += PHONEMIZE_BATCH) {
        const response = await phonemize(sentences.slice(start, start + PHONEMIZE_BATCH));
        results.push(...response.results);
        setG2pVersion(response.g2pVersion);
      }
      setPreview(results);
      setPhase("previewing");
    } catch (error: unknown) {
      setPhase("editing");
      throw error;
    }
  }

  async function commit(rebuild: boolean): Promise<void> {
    if (phase() !== "previewing") return;
    setPhase("saving");
    try {
      const added = await addUserSentences(preview(), g2pVersion());
      showToast(`${added.toLocaleString("id-ID")} kalimat ditambahkan ke kumpulan`, "success");
      if (rebuild) {
        const count = await rebuildScripts();
        showToast(`${count.toLocaleString("id-ID")} naskah disusun ulang`, "success");
      }
      setText("");
      setPreview([]);
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

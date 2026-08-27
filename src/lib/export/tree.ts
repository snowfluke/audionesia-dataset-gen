import type { ExportFormat } from "./manifest.ts";
import { DATASET_ROOT } from "./manifest.ts";

export type TreeNode = { name: string; note?: string; children?: TreeNode[] };

const NOTE_COLUMN = 34;

/** Renders nodes as box-drawing lines; directories end with `/`, notes align in one column. */
export function renderTree(nodes: readonly TreeNode[], prefix = ""): string[] {
  const lines: string[] = [];
  nodes.forEach((node, index) => {
    const last = index === nodes.length - 1;
    const label = `${prefix}${last ? "└─ " : "├─ "}${node.name}${node.children === undefined ? "" : "/"}`;
    lines.push(node.note === undefined ? label : `${label.padEnd(NOTE_COLUMN)}${node.note}`);
    if (node.children !== undefined) {
      lines.push(...renderTree(node.children, `${prefix}${last ? "   " : "│  "}`));
    }
  });
  return lines;
}

export type DatasetTreeOptions = {
  speakerId: string;
  clipCount: number;
  sampleRate: number;
  formats: ReadonlySet<ExportFormat>;
};

/** The folder layout one export produces with these options. */
export function datasetTree(options: DatasetTreeOptions): TreeNode[] {
  const count = options.clipCount.toLocaleString("id-ID");
  const children: TreeNode[] = [
    {
      name: "audio",
      children: [
        {
          name: options.speakerId,
          children: [
            {
              name: "clip_0001.wav ...",
              note: `${count} berkas WAV mono 16-bit ${options.sampleRate.toLocaleString("id-ID")} Hz`,
            },
          ],
        },
      ],
    },
    {
      name: "speakers.jsonl",
      note: `${count} baris: hash, path, text, phonemes, duration, speaker`,
    },
  ];
  if (options.formats.has("hf")) {
    children.push({ name: "metadata.jsonl", note: "Hugging Face audiofolder, dengan kolom split" });
  }
  if (options.formats.has("styletts2")) {
    children.push({
      name: "styletts2",
      children: [
        { name: "train_list.txt", note: "path|fonem|speaker_id, sekitar 95% klip" },
        { name: "val_list.txt", note: "sekitar 5% klip, dipilih dari hash id klip" },
        { name: "OOD_texts.txt", note: "kalimat kumpulan yang belum direkam" },
      ],
    });
  }
  if (options.formats.has("pocket-tts")) {
    children.push({
      name: "pocket-tts",
      children: [
        { name: "train.jsonl", note: '{"path","duration","transcript"}' },
        { name: "valid.jsonl", note: "pembagian yang sama dengan StyleTTS2" },
      ],
    });
  }
  children.push(
    { name: "manifest.json", note: "versi, laju sampel, pembicara, g2p, jumlah klip" },
    { name: "export-warnings.txt", note: "hanya jika ada klip yang dilewati atau diberi catatan" },
    { name: "ATTRIBUTION.md", note: "lisensi dan atribusi per sumber teks" }
  );
  return [{ name: DATASET_ROOT, children }];
}

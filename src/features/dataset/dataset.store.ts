import { createMemo, createSignal } from "solid-js";

import { showToast } from "../../components/toast.tsx";
import { listClipsByStatus } from "../../lib/db/clip.repository.ts";
import type { StorageUsage } from "../../lib/db/database.ts";
import { storageUsage } from "../../lib/db/database.ts";
import type { Clip, ScriptRow, Speaker } from "../../lib/db/schema.ts";
import { getScript } from "../../lib/db/script.repository.ts";
import { getSentences } from "../../lib/db/sentence.repository.ts";
import { listSpeakers } from "../../lib/db/speaker.repository.ts";
import { listUnitLabels } from "../../lib/db/unit.repository.ts";
import type { ExportFormat } from "../../lib/export/export.ts";
import { EXPORT_FORMATS, exportDataset } from "../../lib/export/export.ts";
import { canPickDirectory, createFolderWriter, createZipWriter } from "../../lib/export/writer.ts";
import { clipsVersion } from "../library/library.store.ts";
import { settings } from "../settings/settings.store.ts";
import { speakersVersion } from "../speakers/speakers.store.ts";

const APP_VERSION = "0.1.0";

export type SpeakerStats = {
  speaker: Speaker;
  pending: number;
  approved: number;
  rejected: number;
  approvedSeconds: number;
};

/** Units covered by approved clips versus units present in the pool. */
export type CoverageCount = { covered: number; total: number };

export type CoverageStats = {
  phones: CoverageCount;
  diphones: CoverageCount;
  phenomena: CoverageCount;
};

export type DatasetStats = {
  speakers: SpeakerStats[];
  coverage: CoverageStats;
  storage: StorageUsage | null;
};

export type ExportTarget = "folder" | "zip";
export type ExportProgress = { done: number; total: number };

export type DatasetStore = {
  stats: () => DatasetStats;
  formats: () => Set<ExportFormat>;
  toggleFormat: (format: ExportFormat) => void;
  exporting: () => ExportProgress | null;
  warnings: () => string[];
  exportTo: (target: ExportTarget) => Promise<void>;
  canPickDirectory: () => boolean;
};

function statsFor(speaker: Speaker, clips: readonly Clip[]): SpeakerStats {
  const own = clips.filter((clip) => clip.speakerId === speaker.id);
  return {
    speaker,
    pending: own.filter((clip) => clip.status === "pending").length,
    approved: own.filter((clip) => clip.status === "approved").length,
    rejected: own.filter((clip) => clip.status === "rejected").length,
    approvedSeconds: own
      .filter((clip) => clip.status === "approved")
      .reduce((sum, clip) => sum + clip.durationSec, 0),
  };
}

function countPrefix(
  labels: readonly string[],
  covered: ReadonlySet<number>,
  prefix: string
): CoverageCount {
  let total = 0;
  let hit = 0;
  labels.forEach((label, id) => {
    if (!label.startsWith(prefix)) return;
    total += 1;
    if (covered.has(id)) hit += 1;
  });
  return { covered: hit, total };
}

async function coverageFor(
  approved: readonly Clip[],
  labels: readonly string[]
): Promise<CoverageStats> {
  const scriptIds = [...new Set(approved.map((clip) => clip.scriptId))];
  const scripts = (await Promise.all(scriptIds.map((id) => getScript(id)))).filter(
    (script): script is ScriptRow => script !== undefined
  );
  const sentenceIds = [...new Set(scripts.flatMap((script) => script.sentenceIds))];
  const sentences = await getSentences(sentenceIds);
  const covered = new Set<number>();
  for (const sentence of sentences) for (const unit of sentence.units) covered.add(unit);
  return {
    phones: countPrefix(labels, covered, "p:"),
    diphones: countPrefix(labels, covered, "d:"),
    phenomena: countPrefix(labels, covered, "f:"),
  };
}

/** Call inside the Dataset view. */
export function createDatasetStore(): DatasetStore {
  const [formats, setFormats] = createSignal<Set<ExportFormat>>(new Set(EXPORT_FORMATS));
  const [exporting, setExporting] = createSignal<ExportProgress | null>(null);
  const [warnings, setWarnings] = createSignal<string[]>([]);

  const stats = createMemo(async (): Promise<DatasetStats> => {
    clipsVersion();
    speakersVersion();
    const [speakers, pending, approved, rejected, labels, storage] = await Promise.all([
      listSpeakers(),
      listClipsByStatus("pending"),
      listClipsByStatus("approved"),
      listClipsByStatus("rejected"),
      listUnitLabels(),
      storageUsage(),
    ]);
    const clips = [...pending, ...approved, ...rejected];
    return {
      speakers: speakers.map((speaker) => statsFor(speaker, clips)),
      coverage: await coverageFor(approved, labels),
      storage,
    };
  });

  function toggleFormat(format: ExportFormat): void {
    setFormats((current) => {
      const next = new Set(current);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });
  }

  async function exportTo(target: ExportTarget): Promise<void> {
    if (exporting() !== null) return;
    const writer =
      target === "folder" && canPickDirectory()
        ? await createFolderWriter()
        : createZipWriter(`audionesia-dataset-${new Date().toISOString().slice(0, 10)}.zip`);
    setExporting({ done: 0, total: 0 });
    setWarnings([]);
    try {
      const report = await exportDataset({
        writer,
        formats: formats(),
        sampleRate: settings().exportSampleRate,
        appVersion: APP_VERSION,
        onProgress: (done, total) => setExporting({ done, total }),
      });
      setWarnings(report.warnings);
      showToast(`${report.clips.toLocaleString("id-ID")} klip diekspor`, "success");
    } finally {
      setExporting(null);
    }
  }

  return { stats, formats, toggleFormat, exporting, warnings, exportTo, canPickDirectory };
}

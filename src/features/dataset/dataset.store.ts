import { createMemo, createSignal } from "solid-js";

import { showToast } from "../../components/toast.tsx";
import { exportBackup } from "../../lib/backup/backup.ts";
import { folderSource, restoreBackup, zipSource } from "../../lib/backup/restore.ts";
import { deleteRejectedAudio, listClipsByStatus } from "../../lib/db/clip.repository.ts";
import type { StorageUsage } from "../../lib/db/database.ts";
import { storageUsage } from "../../lib/db/database.ts";
import type { Clip, ScriptRow, Speaker } from "../../lib/db/schema.ts";
import { getScript } from "../../lib/db/script.repository.ts";
import { getSentences } from "../../lib/db/sentence.repository.ts";
import { listSpeakers } from "../../lib/db/speaker.repository.ts";
import { listUnitLabels } from "../../lib/db/unit.repository.ts";
import type { ExportFormat } from "../../lib/export/export.ts";
import { EXPORT_FORMATS, exportDataset } from "../../lib/export/export.ts";
import type { DatasetWriter } from "../../lib/export/writer.ts";
import {
  canPickDirectory,
  createFolderWriter,
  createZipWriter,
  pickDirectory,
} from "../../lib/export/writer.ts";
import { formatBytes, formatCount } from "../../lib/format.ts";
import { bumpClips, clipsVersion } from "../library/library.store.ts";
import { settings } from "../settings/settings.store.ts";
import { speakersVersion } from "../speakers/speakers.store.ts";

const APP_VERSION = "0.1.0";
const BYTES_PER_SAMPLE = 2;

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
  totalApprovedSeconds: number;
  /** Estimated bytes held by rejected clips' master audio. */
  rejectedAudioBytes: number;
  coverage: CoverageStats;
  storage: StorageUsage | null;
};

export type ExportTarget = "folder" | "zip";
export type Progress = { label: string; done: number; total: number };

export type DatasetStore = {
  stats: () => DatasetStats;
  formats: () => Set<ExportFormat>;
  toggleFormat: (format: ExportFormat) => void;
  progress: () => Progress | null;
  warnings: () => string[];
  exportTo: (target: ExportTarget) => Promise<void>;
  backupTo: (target: ExportTarget) => Promise<void>;
  restoreFromFolder: () => Promise<void>;
  restoreFromZip: (file: File) => Promise<void>;
  freeRejectedAudio: () => Promise<void>;
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
  const sentences = await getSentences([
    ...new Set(scripts.flatMap((script) => script.sentenceIds)),
  ]);
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
  const [progress, setProgress] = createSignal<Progress | null>(null);
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
      totalApprovedSeconds: approved.reduce((sum, clip) => sum + clip.durationSec, 0),
      rejectedAudioBytes: rejected.reduce(
        (sum, clip) => sum + clip.durationSec * clip.sampleRate * BYTES_PER_SAMPLE,
        0
      ),
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

  async function writerFor(target: ExportTarget, stem: string): Promise<DatasetWriter> {
    if (target === "folder" && canPickDirectory()) return createFolderWriter();
    return createZipWriter(`${stem}-${new Date().toISOString().slice(0, 10)}.zip`);
  }

  async function run(
    label: string,
    task: (report: (done: number, total: number) => void) => Promise<void>
  ): Promise<void> {
    if (progress() !== null) return;
    setProgress({ label, done: 0, total: 0 });
    try {
      await task((done, total) => setProgress({ label, done, total }));
    } finally {
      setProgress(null);
    }
  }

  async function exportTo(target: ExportTarget): Promise<void> {
    const writer = await writerFor(target, "audionesia-dataset");
    const current = settings();
    const chosenFormats = formats();
    await run("Mengekspor", async (report) => {
      setWarnings([]);
      const result = await exportDataset({
        writer,
        formats: chosenFormats,
        sampleRate: current.exportSampleRate,
        normalizePeakDbfs: current.normalizePeakDbfs,
        minClipSec: current.minClipSec,
        licenseMode: current.licenseMode,
        appVersion: APP_VERSION,
        onProgress: report,
      });
      setWarnings(result.warnings);
      showToast(`${formatCount(result.clips)} klip diekspor`, "success");
    });
  }

  async function backupTo(target: ExportTarget): Promise<void> {
    const writer = await writerFor(target, "audionesia-backup");
    await run("Mencadangkan", async (report) => {
      const result = await exportBackup(writer, report);
      showToast(`${formatCount(result.clips)} klip dicadangkan`, "success");
    });
  }

  async function restoreFromFolder(): Promise<void> {
    const root = await pickDirectory("read");
    await run("Memulihkan", async (report) => {
      const result = await restoreBackup(folderSource(root), report);
      bumpClips();
      showToast(
        `${formatCount(result.clips)} klip dipulihkan, ${formatCount(result.skippedClips)} sudah ada`,
        "success"
      );
    });
  }

  async function restoreFromZip(file: File): Promise<void> {
    await run("Memulihkan", async (report) => {
      const result = await restoreBackup(await zipSource(file), report);
      bumpClips();
      showToast(
        `${formatCount(result.clips)} klip dipulihkan, ${formatCount(result.skippedClips)} sudah ada`,
        "success"
      );
    });
  }

  async function freeRejectedAudio(): Promise<void> {
    const bytes = await deleteRejectedAudio();
    bumpClips();
    showToast(`${formatBytes(bytes)} dibebaskan`, "success");
  }

  return {
    stats,
    formats,
    toggleFormat,
    progress,
    warnings,
    exportTo,
    backupTo,
    restoreFromFolder,
    restoreFromZip,
    freeRejectedAudio,
    canPickDirectory,
  };
}

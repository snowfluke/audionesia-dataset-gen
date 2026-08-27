import { createMemo, createSignal } from "solid-js";

import { showToast } from "../../components/toast.tsx";
import { checkClipWithAsr } from "../../lib/asr/check.ts";
import {
  deleteRejectedAudio,
  listClipsByWorkspace,
  listClipsByWorkspaceStatus,
} from "../../lib/db/clip.repository.ts";
import type { StorageUsage } from "../../lib/db/database.ts";
import { storageUsage } from "../../lib/db/database.ts";
import type { Clip, ScriptRow, Workspace } from "../../lib/db/schema.ts";
import { getScript } from "../../lib/db/script.repository.ts";
import { getSentences } from "../../lib/db/sentence.repository.ts";
import { listUnitLabels } from "../../lib/db/unit.repository.ts";
import type { ExportFormat } from "../../lib/export/export.ts";
import { EXPORT_FORMATS, exportDataset } from "../../lib/export/export.ts";
import type { ExportTarget } from "../../lib/export/writer.ts";
import { canPickDirectory, writerFor } from "../../lib/export/writer.ts";
import { formatBytes, formatCount } from "../../lib/format.ts";
import { bumpClips, clipsVersion } from "../library/library.store.ts";
import { settings } from "../settings/settings.store.ts";
import { currentWorkspace, workspacesVersion } from "../workspaces/workspaces.store.ts";
import type { Progress } from "./progress.ts";
import { createProgressRunner } from "./progress.ts";

const APP_VERSION = "0.2.0";
const BYTES_PER_SAMPLE = 2;

/** Units covered by approved clips versus units present in the pool. */
export type CoverageCount = { covered: number; total: number };

export type CoverageStats = {
  phones: CoverageCount;
  diphones: CoverageCount;
  phenomena: CoverageCount;
};

export type DatasetStats = {
  pending: number;
  approved: number;
  rejected: number;
  approvedSeconds: number;
  /** Estimated bytes held by rejected clips' master audio. */
  rejectedAudioBytes: number;
  coverage: CoverageStats;
  storage: StorageUsage | null;
};

export type DatasetStore = {
  workspace: () => Workspace | null;
  stats: () => DatasetStats;
  formats: () => Set<ExportFormat>;
  toggleFormat: (format: ExportFormat) => void;
  progress: () => Progress | null;
  warnings: () => string[];
  exportTo: (target: ExportTarget) => Promise<void>;
  freeRejectedAudio: () => Promise<void>;
  /** Transcribes every pending clip and flags the ones that differ from their script. */
  checkPendingWithAsr: () => Promise<void>;
  canPickDirectory: () => boolean;
};

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

/** Call inside the Dataset view. Everything here is scoped to the open workspace. */
export function createDatasetStore(): DatasetStore {
  const [formats, setFormats] = createSignal<Set<ExportFormat>>(new Set(EXPORT_FORMATS));
  const [warnings, setWarnings] = createSignal<string[]>([]);
  const runner = createProgressRunner();

  const stats = createMemo(async (): Promise<DatasetStats> => {
    clipsVersion();
    workspacesVersion();
    const workspace = currentWorkspace();
    const [clips, labels, storage] = await Promise.all([
      workspace === null ? [] : listClipsByWorkspace(workspace.id),
      listUnitLabels(),
      storageUsage(),
    ]);
    const approved = clips.filter((clip) => clip.status === "approved");
    const rejected = clips.filter((clip) => clip.status === "rejected");
    return {
      pending: clips.filter((clip) => clip.status === "pending").length,
      approved: approved.length,
      rejected: rejected.length,
      approvedSeconds: approved.reduce((sum, clip) => sum + clip.durationSec, 0),
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

  async function exportTo(target: ExportTarget): Promise<void> {
    const workspace = currentWorkspace();
    if (workspace === null) return;
    const writer = await writerFor(
      target,
      `audionesia-${workspace.id}`,
      `dataset/audio/${workspace.speaker.id}`
    );
    const current = settings();
    const chosenFormats = formats();
    await runner.run("Mengekspor", async (report) => {
      setWarnings([]);
      const result = await exportDataset({
        writer,
        workspaceId: workspace.id,
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

  async function freeRejectedAudio(): Promise<void> {
    const workspace = currentWorkspace();
    if (workspace === null) return;
    const bytes = await deleteRejectedAudio(workspace.id);
    bumpClips();
    showToast(`${formatBytes(bytes)} dibebaskan`, "success");
  }

  async function checkPendingWithAsr(): Promise<void> {
    const workspace = currentWorkspace();
    if (workspace === null) return;
    const current = settings();
    const pending = await listClipsByWorkspaceStatus(workspace.id, "pending");
    if (pending.length === 0) {
      showToast("Tidak ada klip yang menunggu tinjauan");
      return;
    }
    await runner.run("Memeriksa dengan ASR", async (report) => {
      let flagged = 0;
      for (const [done, clip] of pending.entries()) {
        const result = await checkClipWithAsr(clip, current.asrModel, (file, percent) =>
          runner.setProgress({
            label: `Mengunduh ${file} ${percent.toFixed(0)}%`,
            done: 0,
            total: pending.length,
          })
        );
        if (result.cer > current.asrCerWarn) flagged += 1;
        report(done + 1, pending.length);
      }
      bumpClips();
      showToast(
        `${formatCount(flagged)} dari ${formatCount(pending.length)} klip berbeda dari naskah`,
        flagged > 0 ? "info" : "success"
      );
    });
  }

  return {
    workspace: currentWorkspace,
    stats,
    formats,
    toggleFormat,
    progress: runner.progress,
    warnings,
    exportTo,
    freeRejectedAudio,
    checkPendingWithAsr,
    canPickDirectory,
  };
}

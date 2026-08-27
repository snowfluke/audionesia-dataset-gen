import { createMemo } from "solid-js";

import { showToast } from "../../components/toast.tsx";
import { exportBackup } from "../../lib/backup/backup.ts";
import { folderSource, restoreBackup, zipSource } from "../../lib/backup/restore.ts";
import type { ExportTarget } from "../../lib/export/writer.ts";
import { canPickDirectory, pickDirectory, writerFor } from "../../lib/export/writer.ts";
import { formatCount } from "../../lib/format.ts";
import type { Progress } from "../dataset/progress.ts";
import { createProgressRunner } from "../dataset/progress.ts";
import { bumpClips, clipsVersion } from "../library/library.store.ts";
import type { WorkspaceCard } from "./workspaces.store.ts";
import { bumpWorkspaces, loadWorkspaceCards, workspacesVersion } from "./workspaces.store.ts";

export type HomeStore = {
  cards: () => WorkspaceCard[];
  progress: () => Progress | null;
  backupTo: (target: ExportTarget) => Promise<void>;
  restoreFromFolder: () => Promise<void>;
  restoreFromZip: (file: File) => Promise<void>;
  canPickDirectory: () => boolean;
};

/** Call inside the home view. Backup and restore cover every workspace. */
export function createHomeStore(): HomeStore {
  const runner = createProgressRunner();

  const cards = createMemo(async (): Promise<WorkspaceCard[]> => {
    workspacesVersion();
    clipsVersion();
    return loadWorkspaceCards();
  });

  function reportRestore(clips: number, skippedClips: number): void {
    bumpClips();
    bumpWorkspaces();
    showToast(
      `${formatCount(clips)} klip dipulihkan, ${formatCount(skippedClips)} sudah ada`,
      "success"
    );
  }

  async function backupTo(target: ExportTarget): Promise<void> {
    const writer = await writerFor(target, "audionesia-backup");
    await runner.run("Mencadangkan", async (report) => {
      const result = await exportBackup(writer, report);
      showToast(`${formatCount(result.clips)} klip dicadangkan`, "success");
    });
  }

  async function restoreFromFolder(): Promise<void> {
    const root = await pickDirectory("read");
    await runner.run("Memulihkan", async (report) => {
      const result = await restoreBackup(folderSource(root), report);
      reportRestore(result.clips, result.skippedClips);
    });
  }

  async function restoreFromZip(file: File): Promise<void> {
    await runner.run("Memulihkan", async (report) => {
      const result = await restoreBackup(await zipSource(file), report);
      reportRestore(result.clips, result.skippedClips);
    });
  }

  return {
    cards,
    progress: runner.progress,
    backupTo,
    restoreFromFolder,
    restoreFromZip,
    canPickDirectory,
  };
}

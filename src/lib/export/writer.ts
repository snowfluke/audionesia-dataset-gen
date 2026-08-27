import { zipSync } from "fflate";

/** Where exported bytes go: a folder the user picked, or a ZIP download. */
export type DatasetWriter = {
  file(path: string, content: Uint8Array<ArrayBuffer> | string): Promise<void>;
  finish(): Promise<void>;
};

type DirectoryPicker = (options?: {
  mode?: "read" | "readwrite";
}) => Promise<FileSystemDirectoryHandle>;

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- global augmentation requires an interface
  interface Window {
    showDirectoryPicker?: DirectoryPicker;
  }
}

export function canPickDirectory(): boolean {
  return window.showDirectoryPicker !== undefined;
}

export async function pickDirectory(
  mode: "read" | "readwrite"
): Promise<FileSystemDirectoryHandle> {
  const picker = window.showDirectoryPicker;
  if (picker === undefined) throw new Error("Peramban ini tidak mendukung pemilihan folder");
  return picker({ mode });
}

function toBytes(content: Uint8Array<ArrayBuffer> | string): Uint8Array<ArrayBuffer> {
  return content instanceof Uint8Array ? content : new TextEncoder().encode(content);
}

async function directoryAt(
  root: FileSystemDirectoryHandle,
  parts: readonly string[],
  create: boolean
): Promise<FileSystemDirectoryHandle | null> {
  let directory = root;
  for (const part of parts) {
    try {
      directory = await directory.getDirectoryHandle(part, { create });
    } catch {
      return null;
    }
  }
  return directory;
}

/** Removes files directly under `dirPath` that this run did not write, so a deleted clip does not linger. */
async function pruneUnwritten(
  root: FileSystemDirectoryHandle,
  dirPath: string,
  written: ReadonlySet<string>
): Promise<void> {
  const directory = await directoryAt(root, dirPath.split("/"), false);
  if (directory === null) return;
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind !== "file") continue;
    if (!written.has(`${dirPath}/${name}`)) await directory.removeEntry(name);
  }
}

/**
 * Writes straight into a directory chosen with the File System Access API
 * (Chromium). Files under `pruneUnder` that this run does not write are removed.
 */
export async function createFolderWriter(
  root?: FileSystemDirectoryHandle,
  pruneUnder?: string
): Promise<DatasetWriter> {
  const target = root ?? (await pickDirectory("readwrite"));
  const written = new Set<string>();
  return {
    async file(path, content) {
      const parts = path.split("/");
      const name = parts.pop();
      if (name === undefined || name === "") throw new Error(`invalid path ${path}`);
      const directory = await directoryAt(target, parts, true);
      if (directory === null) throw new Error(`cannot create ${path}`);
      const handle = await directory.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(toBytes(content));
      await writable.close();
      written.add(path);
    },
    async finish() {
      if (pruneUnder !== undefined) await pruneUnwritten(target, pruneUnder, written);
    },
  };
}

/**
 * Collects files in memory and triggers one ZIP download at the end.
 * ponytail: everything sits in RAM until finish(); stream to OPFS if datasets outgrow it.
 */
export function createZipWriter(fileName: string): DatasetWriter {
  const files = new Map<string, Uint8Array>();
  return {
    async file(path, content) {
      files.set(path, toBytes(content));
    },
    async finish() {
      const zipped = zipSync(Object.fromEntries(files), { level: 0 });
      const url = URL.createObjectURL(new Blob([zipped], { type: "application/zip" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  };
}

export type ExportTarget = "folder" | "zip";

/** A folder writer when the browser can pick one and the caller asked for it, else a ZIP download. */
export async function writerFor(
  target: ExportTarget,
  stem: string,
  pruneUnder?: string
): Promise<DatasetWriter> {
  if (target === "folder" && canPickDirectory()) return createFolderWriter(undefined, pruneUnder);
  return createZipWriter(`${stem}-${new Date().toISOString().slice(0, 10)}.zip`);
}

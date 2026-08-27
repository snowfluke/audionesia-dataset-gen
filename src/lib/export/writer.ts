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

function toBytes(content: Uint8Array<ArrayBuffer> | string): Uint8Array<ArrayBuffer> {
  return content instanceof Uint8Array ? content : new TextEncoder().encode(content);
}

/** Writes straight into a directory chosen with the File System Access API (Chromium). */
export async function createFolderWriter(): Promise<DatasetWriter> {
  const picker = window.showDirectoryPicker;
  if (picker === undefined) throw new Error("Peramban ini tidak mendukung pemilihan folder");
  const root = await picker({ mode: "readwrite" });
  return {
    async file(path, content) {
      const parts = path.split("/");
      const name = parts.pop();
      if (name === undefined || name === "") throw new Error(`invalid path ${path}`);
      let directory = root;
      for (const part of parts)
        directory = await directory.getDirectoryHandle(part, { create: true });
      const handle = await directory.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(toBytes(content));
      await writable.close();
    },
    async finish() {
      // Files are already on disk.
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

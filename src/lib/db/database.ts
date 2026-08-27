import type { IDBPDatabase } from "idb";
import { openDB } from "idb";

import type { AudionesiaDb } from "./schema.ts";
import { DB_NAME, DB_VERSION } from "./schema.ts";

let connection: Promise<IDBPDatabase<AudionesiaDb>> | null = null;

function createVersion1(database: IDBPDatabase<AudionesiaDb>): void {
  database.createObjectStore("speakers", { keyPath: "id" });
  const sentences = database.createObjectStore("sentences", { keyPath: "id" });
  sentences.createIndex("by-source", "source");
  const scripts = database.createObjectStore("scripts", { keyPath: "id" });
  scripts.createIndex("by-order", "order");
  const clips = database.createObjectStore("clips", { keyPath: "id" });
  clips.createIndex("by-speaker", "speakerId");
  clips.createIndex("by-status", "status");
  clips.createIndex("by-speaker-status", ["speakerId", "status"]);
  clips.createIndex("by-script", "scriptId");
  database.createObjectStore("audio", { keyPath: "clipId" });
  database.createObjectStore("skips", { keyPath: ["speakerId", "scriptId"] });
  database.createObjectStore("settings", { keyPath: "key" });
  database.createObjectStore("units", { keyPath: "id" });
}

/** The single shared connection. Each schema version adds one migration step here. */
export function db(): Promise<IDBPDatabase<AudionesiaDb>> {
  connection ??= openDB<AudionesiaDb>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) createVersion1(database);
    },
    blocking() {
      // Another tab upgraded the schema; drop this connection so the next call reopens.
      connection = null;
    },
  });
  return connection;
}

/** Asks the browser not to evict the database under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!("storage" in navigator) || navigator.storage.persist === undefined) return false;
  return navigator.storage.persist();
}

export type StorageUsage = { usageBytes: number; quotaBytes: number };

export async function storageUsage(): Promise<StorageUsage | null> {
  if (!("storage" in navigator) || navigator.storage.estimate === undefined) return null;
  const estimate = await navigator.storage.estimate();
  return { usageBytes: estimate.usage ?? 0, quotaBytes: estimate.quota ?? 0 };
}

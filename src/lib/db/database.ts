import type { IDBPDatabase, IDBPTransaction, StoreNames } from "idb";
import { openDB, unwrap } from "idb";

import type { AudionesiaDb, Speaker, Workspace } from "./schema.ts";
import { DB_NAME, DB_VERSION } from "./schema.ts";

/** Target hours given to workspaces migrated from the version 1 speaker rows. */
const MIGRATED_TARGET_HOURS = 100;

type UpgradeTx = IDBPTransaction<AudionesiaDb, StoreNames<AudionesiaDb>[], "versionchange">;

let connection: Promise<IDBPDatabase<AudionesiaDb>> | null = null;

function createVersion1(database: IDBPDatabase<AudionesiaDb>): void {
  const sentences = database.createObjectStore("sentences", { keyPath: "id" });
  sentences.createIndex("by-source", "source");
  const scripts = database.createObjectStore("scripts", { keyPath: "id" });
  scripts.createIndex("by-order", "order");
  const clips = database.createObjectStore("clips", { keyPath: "id" });
  clips.createIndex("by-status", "status");
  clips.createIndex("by-script", "scriptId");
  database.createObjectStore("audio", { keyPath: "clipId" });
  database.createObjectStore("settings", { keyPath: "key" });
  database.createObjectStore("units", { keyPath: "id" });
}

/** Version 1 rows, typed only for the migration. */
type LegacySpeaker = Speaker & { nextSeq: number; createdAt: string };
type LegacySkip = { speakerId: string; scriptId: string; skippedAt: string };

/** Reads every row of a store that no longer exists in the typed schema. */
function readLegacyRows<T>(tx: UpgradeTx, storeName: string): Promise<T[]> {
  const request: IDBRequest<T[]> = unwrap(tx).objectStore(storeName).getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`cannot read ${storeName}`));
  });
}

/**
 * Version 2: one speaker becomes one workspace of the same id; clips and
 * skips gain `workspaceId`. Runs inside the upgrade transaction.
 */
async function upgradeToVersion2(
  database: IDBPDatabase<AudionesiaDb>,
  tx: UpgradeTx
): Promise<void> {
  const workspaces = database.createObjectStore("workspaces", { keyPath: "id" });
  const clips = tx.objectStore("clips");
  clips.createIndex("by-workspace", "workspaceId");
  clips.createIndex("by-workspace-status", ["workspaceId", "status"]);
  const raw = unwrap(database);
  if (!raw.objectStoreNames.contains("speakers")) {
    database.createObjectStore("skips", { keyPath: ["workspaceId", "scriptId"] });
    return;
  }
  for (const speaker of await readLegacyRows<LegacySpeaker>(tx, "speakers")) {
    const { nextSeq, createdAt, ...rest } = speaker;
    const workspace: Workspace = {
      id: speaker.id,
      name: speaker.name,
      speaker: rest,
      targetHours: MIGRATED_TARGET_HOURS,
      nextSeq,
      createdAt,
    };
    await workspaces.put(workspace);
  }
  for (const row of await clips.getAll()) {
    await clips.put({ ...row, workspaceId: row.speakerId });
  }
  const skips = await readLegacyRows<LegacySkip>(tx, "skips");
  raw.deleteObjectStore("skips");
  const rebuilt = database.createObjectStore("skips", { keyPath: ["workspaceId", "scriptId"] });
  for (const skip of skips) {
    await rebuilt.put({
      workspaceId: skip.speakerId,
      scriptId: skip.scriptId,
      skippedAt: skip.skippedAt,
    });
  }
  raw.deleteObjectStore("speakers");
}

/** The single shared connection. Each schema version adds one migration step here. */
export function db(): Promise<IDBPDatabase<AudionesiaDb>> {
  connection ??= openDB<AudionesiaDb>(DB_NAME, DB_VERSION, {
    async upgrade(database, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) createVersion1(database);
      if (oldVersion < 2) await upgradeToVersion2(database, tx);
    },
    async blocking() {
      // Another tab wants to upgrade the schema: close this connection so it can.
      const stale = connection;
      connection = null;
      if (stale !== null) (await stale).close();
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

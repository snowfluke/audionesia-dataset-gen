import type { AppSettings } from "../settings.ts";
import { DEFAULT_SETTINGS, appSettingsSchema } from "../settings.ts";
import { db } from "./database.ts";
import type { LibraryMeta } from "./schema.ts";

const SETTINGS_KEY = "app";
const LIBRARY_KEY = "library";

/**
 * Persisted settings validated against the current schema. A row with some
 * invalid fields keeps its valid ones; only those fields fall back to defaults.
 */
export async function loadSettings(): Promise<AppSettings> {
  const row = await (await db()).get("settings", SETTINGS_KEY);
  if (row === undefined || row.key !== "app") return DEFAULT_SETTINGS;
  const parsed = appSettingsSchema.safeParse(row.value);
  if (parsed.success) return parsed.data;
  const bad = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
  const kept = Object.fromEntries(Object.entries(row.value).filter(([key]) => !bad.has(key)));
  const repaired = appSettingsSchema.safeParse(kept);
  return repaired.success ? repaired.data : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await (await db()).put("settings", { key: SETTINGS_KEY, value: settings });
}

export async function loadLibraryMeta(): Promise<LibraryMeta | null> {
  const row = await (await db()).get("settings", LIBRARY_KEY);
  return row !== undefined && row.key === "library" ? row.value : null;
}

export async function saveLibraryMeta(meta: LibraryMeta): Promise<void> {
  await (await db()).put("settings", { key: LIBRARY_KEY, value: meta });
}

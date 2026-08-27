import type { AppSettings } from "../settings.ts";
import { DEFAULT_SETTINGS, appSettingsSchema } from "../settings.ts";
import { db } from "./database.ts";

const SETTINGS_KEY = "app";

/** Persisted settings, validated against the current schema; unknown or invalid rows fall back to defaults. */
export async function loadSettings(): Promise<AppSettings> {
  const row = await (await db()).get("settings", SETTINGS_KEY);
  if (row === undefined) return DEFAULT_SETTINGS;
  const parsed = appSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await (await db()).put("settings", { key: SETTINGS_KEY, value: settings });
}

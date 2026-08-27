import { createSignal } from "solid-js";

import { loadSettings, saveSettings } from "../../lib/db/settings.repository.ts";
import type { AppSettings } from "../../lib/settings.ts";
import { DEFAULT_SETTINGS, appSettingsSchema } from "../../lib/settings.ts";

const [settings, setSettings] = createSignal<AppSettings>(DEFAULT_SETTINGS);

export { settings };

export async function initSettings(): Promise<void> {
  setSettings(await loadSettings());
}

/** Validates the merged settings before they are persisted; an invalid patch throws and changes nothing. */
export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const parsed = appSettingsSchema.safeParse({ ...settings(), ...patch });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      issue === undefined ? "Pengaturan tidak valid" : `Pengaturan tidak valid: ${issue.message}`
    );
  }
  await saveSettings(parsed.data);
  setSettings(parsed.data);
}

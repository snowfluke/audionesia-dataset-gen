import { createSignal } from "solid-js";

import { loadSettings, saveSettings } from "../../lib/db/settings.repository.ts";
import type { AppSettings } from "../../lib/settings.ts";
import { DEFAULT_SETTINGS } from "../../lib/settings.ts";

const [settings, setSettings] = createSignal<AppSettings>(DEFAULT_SETTINGS);

export { settings };

export async function initSettings(): Promise<void> {
  setSettings(await loadSettings());
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const next = { ...settings(), ...patch };
  await saveSettings(next);
  setSettings(next);
}

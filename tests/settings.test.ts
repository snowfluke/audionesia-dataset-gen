import { describe, expect, it } from "bun:test";

import { DEFAULT_SETTINGS, TRAINER_PRESETS, matchingPreset } from "../src/lib/settings.ts";

describe("settings defaults", () => {
  it("start from the StyleTTS2 preset", () => {
    expect(DEFAULT_SETTINGS.targetMinSec).toBe(TRAINER_PRESETS.styletts2.minSec);
    expect(DEFAULT_SETTINGS.targetMaxSec).toBe(TRAINER_PRESETS.styletts2.maxSec);
    expect(DEFAULT_SETTINGS.targetHours).toBe(TRAINER_PRESETS.styletts2.targetHours);
    expect(matchingPreset(DEFAULT_SETTINGS)).toBe("styletts2");
  });

  it("report a custom window as no preset", () => {
    expect(matchingPreset({ ...DEFAULT_SETTINGS, targetMaxSec: 20 })).toBeNull();
  });
});

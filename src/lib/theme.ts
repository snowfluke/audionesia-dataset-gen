export type ThemeMode = "light" | "dark" | "system";

const THEME_KEY = "theme";

function readTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/** Applies Kumo's `data-mode` attribute; "system" follows the OS preference. */
export function applyTheme(mode: ThemeMode): void {
  const dark =
    mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.mode = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // Storage blocked; the attribute still applies for this session.
  }
}

export function currentTheme(): ThemeMode {
  return readTheme();
}

export function nextTheme(mode: ThemeMode): ThemeMode {
  if (mode === "system") return "light";
  if (mode === "light") return "dark";
  return "system";
}

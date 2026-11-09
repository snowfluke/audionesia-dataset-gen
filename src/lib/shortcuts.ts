/** Keys as `KeyboardEvent.key`; " " is the space bar. */
export type ShortcutMap = ReadonlyMap<string, () => void>;

/** One key: what `registerShortcuts` matches, what `aria-keyshortcuts` announces, what the keycap shows. */
export type Shortcut = { key: string; aria: string; label: string };

export const SPACE: Shortcut = { key: " ", aria: "Space", label: "Spasi" };
export const ENTER: Shortcut = { key: "Enter", aria: "Enter", label: "Enter" };

export function letterKey(letter: string): Shortcut {
  return { key: letter.toLowerCase(), aria: letter.toUpperCase(), label: letter.toUpperCase() };
}

const TEXT_INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return TEXT_INPUT_TAGS.has(target.tagName) || target.isContentEditable;
}

/**
 * Registers page-wide shortcuts. Keys are ignored while a text field has
 * focus or a dialog is open, and while a modifier is held. Returns the
 * cleanup function.
 */
export function registerShortcuts(map: ShortcutMap): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (isTyping(event.target) || document.querySelector("dialog[open]") !== null) return;
    const handler = map.get(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    if (handler === undefined) return;
    event.preventDefault();
    handler();
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}

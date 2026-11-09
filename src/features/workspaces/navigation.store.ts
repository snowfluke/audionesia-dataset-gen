import { createSignal } from "solid-js";

/** Tabs inside an open workspace, in display order. */
export const TABS = [
  { id: "record", label: "Rekam" },
  { id: "review", label: "Dengarkan" },
  { id: "write", label: "Teks sendiri" },
  { id: "dataset", label: "Dataset" },
  { id: "settings", label: "Pengaturan" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

const [tab, setTab] = createSignal<TabId>("record");

/** Focus mode hides the app chrome around the Rekam tab; the record store turns it off when the tab closes. */
const [focusMode, setFocusMode] = createSignal(false);

export { focusMode, setFocusMode, setTab, tab };

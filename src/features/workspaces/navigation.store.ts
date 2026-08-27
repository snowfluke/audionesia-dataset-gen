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

export { setTab, tab };

import { createSignal } from "solid-js";

import { listClips } from "../../lib/db/clip.repository.ts";
import type { AgeRange, Speaker, SpeakerGender, Workspace } from "../../lib/db/schema.ts";
import {
  createWorkspaceIfAbsent,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  putWorkspace,
} from "../../lib/db/workspace.repository.ts";
import { slugify } from "../../lib/slug.ts";
import { setTab } from "./navigation.store.ts";

const LAST_WORKSPACE_KEY = "audionesia:workspace";

const [workspacesVersion, setWorkspacesVersion] = createSignal(0);
const [currentWorkspace, setCurrentWorkspace] = createSignal<Workspace | null>(null);

export { currentWorkspace, workspacesVersion };

export function bumpWorkspaces(): void {
  setWorkspacesVersion((version) => version + 1);
}

function remember(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(LAST_WORKSPACE_KEY);
    else localStorage.setItem(LAST_WORKSPACE_KEY, id);
  } catch {
    // Storage may be blocked; the selection still holds for this session.
  }
}

function readLast(): string | null {
  try {
    return localStorage.getItem(LAST_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

/** Reopens the workspace used last time, when it still exists. */
export async function initWorkspaces(): Promise<void> {
  const id = readLast();
  if (id === null) return;
  const workspace = await getWorkspace(id);
  if (workspace === undefined) {
    remember(null);
    return;
  }
  setCurrentWorkspace(workspace);
}

export async function openWorkspace(id: string): Promise<void> {
  const workspace = await getWorkspace(id);
  if (workspace === undefined) throw new Error("Dataset tidak ditemukan");
  setCurrentWorkspace(workspace);
  remember(id);
  setTab("record");
}

export function closeWorkspace(): void {
  setCurrentWorkspace(null);
  remember(null);
}

export type NewWorkspace = {
  name: string;
  speakerName: string;
  targetHours: number;
  gender: SpeakerGender | null;
  ageRange: AgeRange | null;
  dialect: string;
  microphone: string;
  consent: boolean;
};

export async function createWorkspace(input: NewWorkspace): Promise<Workspace> {
  const id = slugify(input.name);
  if (id === "") throw new Error("Nama dataset harus memuat huruf atau angka");
  const speakerId = slugify(input.speakerName);
  if (speakerId === "") throw new Error("Nama pembicara harus memuat huruf atau angka");
  if (!input.consent) throw new Error("Persetujuan pembicara diperlukan sebelum merekam");
  if (!(input.targetHours > 0)) throw new Error("Target jam harus lebih dari nol");
  const now = new Date().toISOString();
  const speaker: Speaker = { id: speakerId, name: input.speakerName.trim(), consentAt: now };
  if (input.gender !== null) speaker.gender = input.gender;
  if (input.ageRange !== null) speaker.ageRange = input.ageRange;
  if (input.dialect.trim() !== "") speaker.dialect = input.dialect.trim();
  if (input.microphone.trim() !== "") speaker.microphone = input.microphone.trim();
  const workspace: Workspace = {
    id,
    name: input.name.trim(),
    speaker,
    targetHours: input.targetHours,
    nextSeq: 1,
    createdAt: now,
  };
  if (!(await createWorkspaceIfAbsent(workspace))) throw new Error(`Dataset "${id}" sudah ada`);
  bumpWorkspaces();
  setCurrentWorkspace(workspace);
  remember(id);
  setTab("record");
  return workspace;
}

/** Edits the open workspace; the stored row wins over the signal for `nextSeq`. */
export async function updateWorkspace(
  patch: Partial<Pick<Workspace, "name" | "targetHours">>
): Promise<void> {
  const current = currentWorkspace();
  if (current === null) return;
  const fresh = (await getWorkspace(current.id)) ?? current;
  const next: Workspace = { ...fresh, ...patch };
  await putWorkspace(next);
  setCurrentWorkspace(next);
  bumpWorkspaces();
}

export async function removeWorkspace(id: string): Promise<void> {
  await deleteWorkspace(id);
  if (currentWorkspace()?.id === id) closeWorkspace();
  bumpWorkspaces();
}

export type WorkspaceCard = {
  workspace: Workspace;
  pending: number;
  approved: number;
  rejected: number;
  approvedSeconds: number;
};

/** Every workspace with its clip counts, for the home page. */
export async function loadWorkspaceCards(): Promise<WorkspaceCard[]> {
  const [workspaces, clips] = await Promise.all([listWorkspaces(), listClips()]);
  const cards = new Map<string, WorkspaceCard>(
    workspaces.map((workspace) => [
      workspace.id,
      { workspace, pending: 0, approved: 0, rejected: 0, approvedSeconds: 0 },
    ])
  );
  for (const clip of clips) {
    const card = cards.get(clip.workspaceId);
    if (card === undefined) continue;
    card[clip.status] += 1;
    if (clip.status === "approved") card.approvedSeconds += clip.durationSec;
  }
  return [...cards.values()];
}

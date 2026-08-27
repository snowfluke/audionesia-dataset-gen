import { createSignal } from "solid-js";

import type { Speaker, SpeakerGender } from "../../lib/db/schema.ts";
import {
  deleteSpeaker,
  getSpeaker,
  listSpeakers,
  putSpeaker,
} from "../../lib/db/speaker.repository.ts";
import { slugify } from "../../lib/slug.ts";

const LAST_SPEAKER_KEY = "audionesia:speaker";

function readLastSpeaker(): string | null {
  try {
    return localStorage.getItem(LAST_SPEAKER_KEY);
  } catch {
    return null;
  }
}

const [speakersVersion, setSpeakersVersion] = createSignal(0);
const [currentSpeakerId, setCurrentSpeakerId] = createSignal<string | null>(readLastSpeaker());

export { currentSpeakerId, speakersVersion };

export function selectSpeaker(id: string | null): void {
  setCurrentSpeakerId(id);
  try {
    if (id === null) localStorage.removeItem(LAST_SPEAKER_KEY);
    else localStorage.setItem(LAST_SPEAKER_KEY, id);
  } catch {
    // Storage may be blocked; the selection still holds for this session.
  }
}

/** Reads every speaker; re-runs when `speakersVersion` changes. */
export async function loadSpeakers(): Promise<Speaker[]> {
  const speakers = await listSpeakers();
  const selected = currentSpeakerId();
  if (selected !== null && !speakers.some((speaker) => speaker.id === selected)) {
    selectSpeaker(speakers[0]?.id ?? null);
  } else if (selected === null && speakers.length > 0) {
    selectSpeaker(speakers[0]?.id ?? null);
  }
  return speakers;
}

export async function createSpeaker(
  name: string,
  gender: SpeakerGender | undefined
): Promise<Speaker> {
  const id = slugify(name);
  if (id === "") throw new Error("Nama pembicara harus memuat huruf atau angka");
  if ((await getSpeaker(id)) !== undefined) throw new Error(`Pembicara "${id}" sudah ada`);
  const speaker: Speaker = {
    id,
    name: name.trim(),
    nextSeq: 1,
    createdAt: new Date().toISOString(),
  };
  if (gender !== undefined) speaker.gender = gender;
  await putSpeaker(speaker);
  setSpeakersVersion((version) => version + 1);
  selectSpeaker(id);
  return speaker;
}

export async function removeSpeaker(id: string): Promise<void> {
  await deleteSpeaker(id);
  if (currentSpeakerId() === id) selectSpeaker(null);
  setSpeakersVersion((version) => version + 1);
}

import { createSignal } from "solid-js";

import type { AgeRange, Speaker, SpeakerGender } from "../../lib/db/schema.ts";
import {
  createSpeakerIfAbsent,
  deleteSpeaker,
  listSpeakers,
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

/** Reads every speaker in creation order; re-runs when `speakersVersion` changes. */
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

export type NewSpeaker = {
  name: string;
  gender: SpeakerGender | null;
  ageRange: AgeRange | null;
  dialect: string;
  microphone: string;
  consent: boolean;
};

export async function createSpeaker(input: NewSpeaker): Promise<Speaker> {
  const id = slugify(input.name);
  if (id === "") throw new Error("Nama pembicara harus memuat huruf atau angka");
  if (!input.consent) throw new Error("Persetujuan pembicara diperlukan sebelum merekam");
  const now = new Date().toISOString();
  const speaker: Speaker = {
    id,
    name: input.name.trim(),
    nextSeq: 1,
    createdAt: now,
    consentAt: now,
  };
  if (input.gender !== null) speaker.gender = input.gender;
  if (input.ageRange !== null) speaker.ageRange = input.ageRange;
  if (input.dialect.trim() !== "") speaker.dialect = input.dialect.trim();
  if (input.microphone.trim() !== "") speaker.microphone = input.microphone.trim();
  if (!(await createSpeakerIfAbsent(speaker))) throw new Error(`Pembicara "${id}" sudah ada`);
  setSpeakersVersion((version) => version + 1);
  selectSpeaker(id);
  return speaker;
}

export async function removeSpeaker(id: string): Promise<void> {
  await deleteSpeaker(id);
  if (currentSpeakerId() === id) selectSpeaker(null);
  setSpeakersVersion((version) => version + 1);
}

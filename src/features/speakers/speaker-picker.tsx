import type { JSX } from "@solidjs/web";
import { Loading, Show, createMemo, createSignal } from "solid-js";

import Button from "../../components/button.tsx";
import Dialog from "../../components/dialog.tsx";
import Input from "../../components/input.tsx";
import Select from "../../components/select.tsx";
import { attempt } from "../../components/toast.tsx";
import type { AgeRange, SpeakerGender } from "../../lib/db/schema.ts";
import { slugify } from "../../lib/slug.ts";
import type { NewSpeaker } from "./speakers.store.ts";
import {
  createSpeaker,
  currentSpeakerId,
  loadSpeakers,
  removeSpeaker,
  selectSpeaker,
  speakersVersion,
} from "./speakers.store.ts";

const UNSET = "unspecified";
const GENDER_OPTIONS: { value: SpeakerGender | typeof UNSET; label: string }[] = [
  { value: UNSET, label: "Tidak disebutkan" },
  { value: "female", label: "Perempuan" },
  { value: "male", label: "Laki-laki" },
  { value: "other", label: "Lainnya" },
];
const AGE_OPTIONS: { value: AgeRange | typeof UNSET; label: string }[] = [
  { value: UNSET, label: "Tidak disebutkan" },
  { value: "under-18", label: "Di bawah 18" },
  { value: "18-29", label: "18-29" },
  { value: "30-44", label: "30-44" },
  { value: "45-59", label: "45-59" },
  { value: "60-plus", label: "60 ke atas" },
];

const EMPTY: NewSpeaker = {
  name: "",
  gender: null,
  ageRange: null,
  dialect: "",
  microphone: "",
  consent: false,
};

export default function SpeakerPicker(): JSX.Element {
  const speakers = createMemo(async () => {
    speakersVersion();
    return loadSpeakers();
  });
  const [open, setOpen] = createSignal(false);
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [draft, setDraft] = createSignal<NewSpeaker>(EMPTY);
  const patch = (changes: Partial<NewSpeaker>): void => {
    setDraft((current) => ({ ...current, ...changes }));
  };

  async function submit(): Promise<void> {
    await createSpeaker(draft());
    setDraft(EMPTY);
    setOpen(false);
  }

  return (
    <div class="flex items-center gap-2">
      <Loading fallback={<span class="text-xs text-kumo-subtle">Memuat pembicara...</span>}>
        <Show
          when={speakers().length > 0}
          fallback={<span class="text-base text-kumo-subtle">Belum ada pembicara</span>}
        >
          <Select
            aria-label="Pembicara"
            options={speakers().map((speaker) => ({
              value: speaker.id,
              label: `${speaker.name} (${speaker.id})`,
            }))}
            value={currentSpeakerId() ?? ""}
            onChange={(id) => selectSpeaker(id)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            disabled={currentSpeakerId() === null}
          >
            Hapus
          </Button>
        </Show>
      </Loading>
      <Button size="sm" onClick={() => setOpen(true)}>
        + Pembicara baru
      </Button>

      <Dialog
        open={open()}
        onClose={() => setOpen(false)}
        title="Pembicara baru"
        description="Nama menjadi nama folder di dataset/audio/. Data lain masuk ke manifest.json."
      >
        <form
          class="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void attempt(submit);
          }}
        >
          <label class="flex flex-col gap-1 text-base">
            Nama
            <Input
              value={draft().name}
              onInput={(event) => patch({ name: event.currentTarget.value })}
              placeholder="Budi Santoso"
              required
            />
          </label>
          <span class="text-xs text-kumo-subtle">
            Folder: {slugify(draft().name) === "" ? "-" : slugify(draft().name)}
          </span>
          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 text-base">
              Jenis kelamin
              <Select
                options={GENDER_OPTIONS}
                value={draft().gender ?? UNSET}
                onChange={(value) => patch({ gender: value === UNSET ? null : value })}
              />
            </label>
            <label class="flex flex-col gap-1 text-base">
              Rentang usia
              <Select
                options={AGE_OPTIONS}
                value={draft().ageRange ?? UNSET}
                onChange={(value) => patch({ ageRange: value === UNSET ? null : value })}
              />
            </label>
          </div>
          <label class="flex flex-col gap-1 text-base">
            Dialek atau logat daerah
            <Input
              value={draft().dialect}
              onInput={(event) => patch({ dialect: event.currentTarget.value })}
              placeholder="Jawa Tengah, Betawi, ..."
            />
          </label>
          <label class="flex flex-col gap-1 text-base">
            Mikrofon
            <Input
              value={draft().microphone}
              onInput={(event) => patch({ microphone: event.currentTarget.value })}
              placeholder="Shure MV7, mikrofon laptop, ..."
            />
          </label>
          <label class="flex items-start gap-2 text-base">
            <input
              type="checkbox"
              class="mt-1"
              checked={draft().consent}
              onChange={(event) => patch({ consent: event.currentTarget.checked })}
            />
            <span>
              Pembicara setuju suaranya dipakai untuk melatih model text-to-speech dan dibagikan
              sebagai bagian dari dataset.
            </span>
          </label>
          <div class="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit" disabled={!draft().consent}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={confirmDelete()}
        onClose={() => setConfirmDelete(false)}
        title="Hapus pembicara?"
        description="Semua klip dan audio pembicara ini ikut terhapus dan tidak bisa dikembalikan."
      >
        <div class="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              void attempt(async () => {
                const id = currentSpeakerId();
                if (id !== null) await removeSpeaker(id);
                setConfirmDelete(false);
              })
            }
          >
            Hapus
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

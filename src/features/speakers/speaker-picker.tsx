import type { JSX } from "@solidjs/web";
import { Loading, Show, createMemo, createSignal } from "solid-js";

import Button from "../../components/button.tsx";
import Dialog from "../../components/dialog.tsx";
import Input from "../../components/input.tsx";
import Select from "../../components/select.tsx";
import { attempt } from "../../components/toast.tsx";
import type { SpeakerGender } from "../../lib/db/schema.ts";
import { slugify } from "../../lib/slug.ts";
import {
  createSpeaker,
  currentSpeakerId,
  loadSpeakers,
  removeSpeaker,
  selectSpeaker,
  speakersVersion,
} from "./speakers.store.ts";

const GENDER_OPTIONS: { value: SpeakerGender | "unspecified"; label: string }[] = [
  { value: "unspecified", label: "Tidak disebutkan" },
  { value: "female", label: "Perempuan" },
  { value: "male", label: "Laki-laki" },
  { value: "other", label: "Lainnya" },
];

export default function SpeakerPicker(): JSX.Element {
  const speakers = createMemo(async () => {
    speakersVersion();
    return loadSpeakers();
  });
  const [open, setOpen] = createSignal(false);
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [name, setName] = createSignal("");
  const [gender, setGender] = createSignal<SpeakerGender | "unspecified">("unspecified");

  async function submit(): Promise<void> {
    const chosen = gender();
    await createSpeaker(name(), chosen === "unspecified" ? undefined : chosen);
    setName("");
    setGender("unspecified");
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
        description="Nama menjadi nama folder di dataset/audio/."
      >
        <form
          class="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            attempt(submit);
          }}
        >
          <label class="flex flex-col gap-1 text-base">
            Nama
            <Input
              value={name()}
              onInput={(event) => setName(event.currentTarget.value)}
              placeholder="Budi Santoso"
              required
            />
          </label>
          <span class="text-xs text-kumo-subtle">
            Folder: {slugify(name()) === "" ? "-" : slugify(name())}
          </span>
          <label class="flex flex-col gap-1 text-base">
            Jenis kelamin
            <Select options={GENDER_OPTIONS} value={gender()} onChange={setGender} />
          </label>
          <div class="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" type="submit">
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
              attempt(async () => {
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

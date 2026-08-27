import type { JSX } from "@solidjs/web";
import { createSignal, untrack } from "solid-js";

import Button from "../../components/button.tsx";
import Dialog from "../../components/dialog.tsx";
import Input from "../../components/input.tsx";
import Select from "../../components/select.tsx";
import { attempt } from "../../components/toast.tsx";
import type { AgeRange, SpeakerGender } from "../../lib/db/schema.ts";
import { slugify } from "../../lib/slug.ts";
import { settings } from "../settings/settings.store.ts";
import type { NewWorkspace } from "./workspaces.store.ts";
import { createWorkspace } from "./workspaces.store.ts";

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

/** A one-time snapshot: the default target comes from settings when the dialog mounts. */
function emptyDraft(): NewWorkspace {
  return {
    name: "",
    speakerName: "",
    targetHours: settings().targetHours,
    gender: null,
    ageRange: null,
    dialect: "",
    microphone: "",
    consent: false,
  };
}

function slugOrDash(name: string): string {
  const slug = slugify(name);
  return slug === "" ? "-" : slug;
}

export type WorkspaceDialogProps = { open: boolean; onClose: () => void };

/** Creates a dataset workspace: name, one speaker with consent, and a target in hours. */
export default function WorkspaceDialog(props: WorkspaceDialogProps): JSX.Element {
  const [draft, setDraft] = createSignal<NewWorkspace>(untrack(emptyDraft));
  const patch = (changes: Partial<NewWorkspace>): void => {
    setDraft((current) => ({ ...current, ...changes }));
  };

  async function submit(): Promise<void> {
    await createWorkspace(draft());
    setDraft(untrack(emptyDraft));
    props.onClose();
  }

  return (
    <Dialog
      open={props.open}
      onClose={() => props.onClose()}
      title="Dataset baru"
      description="Satu dataset berisi satu pembicara. Nama pembicara menjadi nama folder di dataset/audio/."
      size="lg"
    >
      <form
        class="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void attempt(submit);
        }}
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="flex flex-col gap-1 text-base">
            Nama dataset
            <Input
              value={draft().name}
              onInput={(event) => patch({ name: event.currentTarget.value })}
              placeholder="Suara Budi"
              required
            />
            <span class="text-xs text-kumo-subtle">Id: {slugOrDash(draft().name)}</span>
          </label>
          <label class="flex flex-col gap-1 text-base">
            Nama pembicara
            <Input
              value={draft().speakerName}
              onInput={(event) => patch({ speakerName: event.currentTarget.value })}
              placeholder="Budi Santoso"
              required
            />
            <span class="text-xs text-kumo-subtle">
              Folder: dataset/audio/{slugOrDash(draft().speakerName)}/
            </span>
          </label>
        </div>
        <label class="flex flex-col gap-1 text-base">
          Target rekaman (jam)
          <Input
            type="number"
            min={0.5}
            step={0.5}
            value={draft().targetHours}
            onChange={(event) => {
              const value = Number(event.currentTarget.value);
              if (Number.isFinite(value)) patch({ targetHours: value });
            }}
            required
          />
        </label>
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
        <div class="grid gap-3 sm:grid-cols-2">
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
        </div>
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
          <Button variant="ghost" onClick={() => props.onClose()}>
            Batal
          </Button>
          <Button variant="primary" type="submit" disabled={!draft().consent}>
            Buat dataset
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

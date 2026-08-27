import type { JSX } from "@solidjs/web";
import { For, Loading, Show, createSignal } from "solid-js";

import Badge from "../../components/badge.tsx";
import Banner from "../../components/banner.tsx";
import Button from "../../components/button.tsx";
import Dialog from "../../components/dialog.tsx";
import LayerCard from "../../components/layer-card.tsx";
import Meter from "../../components/meter.tsx";
import { attempt } from "../../components/toast.tsx";
import type { Workspace } from "../../lib/db/schema.ts";
import { formatCount, formatDuration } from "../../lib/format.ts";
import BackupPanel from "./backup-panel.tsx";
import { createHomeStore } from "./home.store.ts";
import WorkspaceDialog from "./workspace-dialog.tsx";
import type { WorkspaceCard } from "./workspaces.store.ts";
import { openWorkspace, removeWorkspace } from "./workspaces.store.ts";

const SECONDS_PER_HOUR = 3600;

function FolderIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
      <path
        d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </svg>
  );
}

type FolderProps = {
  card: WorkspaceCard;
  onOpen: (id: string) => void;
  onDelete: (workspace: Workspace) => void;
};

function WorkspaceFolder(props: FolderProps): JSX.Element {
  const workspace = (): Workspace => props.card.workspace;
  const target = (): number => workspace().targetHours * SECONDS_PER_HOUR;
  return (
    <LayerCard class="flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <span class="text-kumo-subtle">
          <FolderIcon />
        </span>
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <button
            type="button"
            class="truncate text-left text-lg font-semibold text-kumo-strong hover:underline"
            onClick={() => props.onOpen(workspace().id)}
          >
            {workspace().name}
          </button>
          <div class="flex flex-wrap items-center gap-2 text-base text-kumo-subtle">
            <span>Pembicara: {workspace().speaker.name}</span>
            <Show when={workspace().speaker.dialect}>
              {(dialect) => <Badge>{dialect()}</Badge>}
            </Show>
          </div>
        </div>
      </div>
      <Meter
        value={props.card.approvedSeconds}
        max={target()}
        label="Durasi disetujui"
        detail={`${formatDuration(props.card.approvedSeconds)} / ${workspace().targetHours} jam`}
      />
      <div class="flex flex-wrap items-center gap-2 text-xs text-kumo-subtle">
        <span>{formatCount(props.card.pending)} menunggu</span>
        <span>· {formatCount(props.card.approved)} disetujui</span>
        <span>· {formatCount(props.card.rejected)} ditolak</span>
      </div>
      <div class="flex gap-2">
        <Button variant="primary" size="sm" onClick={() => props.onOpen(workspace().id)}>
          Buka
        </Button>
        <Button variant="ghost" size="sm" onClick={() => props.onDelete(workspace())}>
          Hapus
        </Button>
      </div>
    </LayerCard>
  );
}

/** The landing page: every dataset as a folder with its progress. */
export default function HomeView(): JSX.Element {
  const store = createHomeStore();
  const [creating, setCreating] = createSignal(false);
  const [deleting, setDeleting] = createSignal<Workspace | null>(null);
  const open = (id: string): void => void attempt(() => openWorkspace(id));
  const confirmDelete = (workspace: Workspace): void => {
    void attempt(async () => {
      await removeWorkspace(workspace.id);
      setDeleting(null);
    });
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h2 class="text-lg font-semibold text-kumo-strong">Dataset</h2>
          <p class="text-base text-kumo-subtle">
            Satu dataset berisi satu pembicara. Buka dataset untuk merekam, meninjau, dan
            mengekspor.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          + Dataset baru
        </Button>
      </div>
      <Loading fallback={<p class="text-kumo-subtle">Memuat dataset...</p>}>
        <Show
          when={store.cards().length > 0}
          fallback={
            <Banner>
              Belum ada dataset. Buat dataset baru, isi nama pembicara dan target jam, lalu mulai
              merekam.
            </Banner>
          }
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <For each={store.cards()}>
              {(card) => <WorkspaceFolder card={card} onOpen={open} onDelete={setDeleting} />}
            </For>
          </div>
        </Show>
      </Loading>

      <BackupPanel store={store} />

      <WorkspaceDialog open={creating()} onClose={() => setCreating(false)} />
      <Dialog
        open={deleting() !== null}
        onClose={() => setDeleting(null)}
        title={`Hapus dataset "${deleting()?.name ?? ""}"?`}
        description="Semua klip dan audio di dataset ini ikut terhapus dan tidak bisa dikembalikan."
      >
        <div class="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              const workspace = deleting();
              if (workspace !== null) confirmDelete(workspace);
            }}
          >
            Hapus
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

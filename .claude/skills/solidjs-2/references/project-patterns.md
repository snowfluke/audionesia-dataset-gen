# How this codebase uses Solid 2.0

Read `docs/CODING_STANDARD.md` §3 and §4 for the rules; this file shows the shapes.

## Layering

```
components  <-  features/*.view.tsx  ->  features/*.store.ts  ->  lib/*  ->  workers (via lib/<x>/client.ts)
```

Views hold JSX and view-local state. Stores own feature state and every action. `lib/` is pure where possible and DOM-bound only in files named for it.

## Global stores: module-level signals, no memos

`features/workspaces/workspaces.store.ts`, `features/settings/settings.store.ts`, `features/library/library.store.ts` create signals at module scope and export accessors plus async actions. They never create memos or effects, because there is no owner at module scope.

```ts
const [settings, setSettings] = createSignal<AppSettings>(DEFAULT_SETTINGS);
export { settings };
export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const parsed = appSettingsSchema.safeParse({ ...settings(), ...patch }); // validate before persisting
  if (!parsed.success) throw new Error("Pengaturan tidak valid");
  await saveSettings(parsed.data);
  setSettings(parsed.data);
}
```

## Per-tab stores: a factory called from the view

`createRecordStore()`, `createReviewStore()`, `createWriteStore()`, `createDatasetStore()` are called inside the view component so `createMemo` and `onCleanup` have an owner. They return a named type with function-typed members.

```ts
export type ReviewStore = {
  pending: () => Clip[];
  current: () => Clip | undefined;
  decide: (status: ClipStatus) => Promise<void>;
};

export function createReviewStore(): ReviewStore {
  const pending = createMemo(async (): Promise<Clip[]> => {
    clipsVersion();                       // dependency: re-run after any clip write
    const workspace = currentWorkspace();
    if (workspace === null) return [];
    return listClipsByWorkspaceStatus(workspace.id, "pending");
  });
  const current = (): Clip | undefined => pending()[0];
  async function decide(status: ClipStatus): Promise<void> {
    const clip = current();
    if (clip === undefined) return;
    await setClipStatus(clip.id, status);
    bumpClips();                          // invalidates every memo that read clipsVersion()
  }
  onCleanup(() => { /* stop playback, unregister shortcuts */ });
  return { pending, current, decide };
}
```

## Views read async memos inside Loading

```tsx
<Loading fallback={<p class="text-kumo-subtle">Memuat klip...</p>}>
  <Show when={store.current()} fallback={<Banner>Tidak ada klip.</Banner>}>
    {(clip) => <p class="text-2xl">{clip().text}</p>}
  </Show>
</Loading>
```

`app.tsx` wraps the tab content in `<Errored fallback={(error, reset) => ...}>`, so a rejected memo shows a banner with a retry button.

## Event handlers and async work

```tsx
<Button onClick={() => void attempt(store.save)}>Simpan</Button>
```

`attempt` (in `src/components/toast.tsx`) is `async`: it awaits the task and reports failures with a toast, so handlers never chain `.catch`. Prefix the call with `void` in a handler that does not await it. An inner arrow passed to `attempt` must not read `props`; capture `const store = props.store` in the handler first, or `solid/reactivity` flags it.

## Components

One component per file in `src/components/`, default export, props type `<Name>Props`. Defaults via `merge`, forwarding via `omit` captured in a variable, Kumo class strings in `as const` maps, structured `class` arrays.

```tsx
export default function Button(props: ButtonProps): JSX.Element {
  const local = merge({ variant: "secondary", size: "base", type: "button" } as const, props);
  const rest = omit(local, "variant", "size", "class", "children");
  return (
    <button {...rest} class={[BASE, VARIANTS[local.variant], SIZES[local.size], local.class]}>
      {local.children}
    </button>
  );
}
```

Native elements first: `<dialog>` with `showModal()` driven by a two-function effect, `<select>`, `<button role="switch">`.

## Workers

`lib/worker-rpc.ts` wraps one request/response in a promise and terminates the worker. Workers are created with `new Worker(new URL("../../workers/x.worker.ts", import.meta.url), { type: "module" })`; the audio worklet is imported as `?worker&url` and passed to `audioWorklet.addModule`. Stores call the typed client (`lib/g2p/client.ts`, `lib/corpus/builder-client.ts`); views never touch `postMessage`.

## Keyboard shortcuts

`lib/shortcuts.ts` registers one `keydown` listener per store and returns the cleanup for `onCleanup`. Shortcuts are ignored while typing in a field or while a `<dialog>` is open.

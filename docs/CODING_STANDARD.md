# Coding Standard

## Audionesia Dataset Gen

**Version:** 1.0.0  
**Date:** 2026-08-27  
**Author:** Tech Lead  
**Status:** Enforced

---

Audionesia is a static SolidJS 2.0 web app. It builds an Indonesian text-to-speech dataset: phoneme-balanced reading scripts from `indo-g2p`, in-browser recording, IndexedDB storage, and export to the `dataset/` layout plus StyleTTS2 and PocketTTS manifests. No server. Bun is the runtime for tooling, scripts, and tests.

Verification gate, run before any task is marked complete:

```bash
bun run type-check   # tsc on src, then on scripts + tests
bun run lint         # oxlint with anti-slop and eslint-plugin-solid
bun run fmt          # oxfmt --check
bun test
bun run build        # vite build to dist/
bun run complete-check   # all of the above
```

Rules marked **(enforced)** are checked by the linter, the formatter, the type checker, or a git hook. Reviewers do not check them by hand.

## Table of Contents

1. [General Principles](#1-general-principles)
2. [TypeScript Standards](#2-typescript-standards)
3. [Application Structure](#3-application-structure)
4. [SolidJS 2.0 Rules](#4-solidjs-20-rules)
5. [IndexedDB Standards](#5-indexeddb-standards)
6. [Testing Standards](#6-testing-standards)
7. [Git Workflow](#7-git-workflow)
8. [File and Folder Naming](#8-file-and-folder-naming)
9. [Code Formatting](#9-code-formatting)
10. [Localization and User-Facing Copy](#10-localization-and-user-facing-copy)
11. [Audio and Dataset Invariants](#11-audio-and-dataset-invariants)

---

## 1. General Principles

- Write code for the next developer.
- Prefer explicit over implicit. No hidden side effects. No magic configuration.
- Each function, file, or module does one thing.
- Comments explain why, not what. A file that needs a comment to explain what it does needs a better name.
- No dead code on `main`.
- No `// @ts-ignore` or `any`. `// @ts-expect-error` needs a reason **(enforced)**.
- No file exceeds **300 lines** **(enforced)**. Split at 250 lines proactively into sibling files in the same folder (`record.store.ts` and `record.batch.ts`), not into a `utils` bucket.
- Take the platform before a library: `<dialog>` before a modal package, `OfflineAudioContext` before a resampler package, IndexedDB before a state-sync package. Add a dependency only when a few lines cannot do the job.
- Mark a deliberate shortcut with a `// ponytail:` comment that names its ceiling and its upgrade path.

## 2. TypeScript Standards

### 2.1 Compiler Settings

`tsconfig.json` (app) and `tsconfig.node.json` (scripts, tests, Vite config) both enforce:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true
  }
}
```

The app config uses `"jsx": "preserve"` and `"jsxImportSource": "@solidjs/web"`. The node config uses `"types": ["bun"]` and no DOM lib, so anything a test imports must be DOM-free.

### 2.2 Rules

- No `any` **(enforced)**. Use `unknown` and narrow with a type guard.
- Exported functions carry explicit return types **(enforced)**.
- `type` for data shapes **(enforced)**. `interface` only for an extensible contract, and there is none in this codebase yet.
- Enum-like values are string literal unions, never TypeScript `enum`.
- `import type` lives in its own statement **(enforced)**.
- No `!` non-null assertions **(enforced)**. Handle `null` and `undefined` explicitly.
- No `as` casts except with a `// SAFETY:` comment that states why the assertion holds **(enforced)**. Never chain assertions and never widen a known type to assert it back **(enforced)**.
- `catch (error: unknown)` **(enforced)**. Narrow before use.
- `async` / `await` only. No `.then()` chains **(enforced)**. No fire-and-forget promises; a detached call ends in `.catch(reportError)`.
- Zod schemas are the source of truth for any data that crosses a trust boundary: imported text files, the bundled corpus pool, exported manifests, and `settings` values. Derive the TypeScript type with `z.infer<>`.

```typescript
// Correct
import type { WordTrace } from "indo-g2p";
import { explain } from "indo-g2p";

export function isEnglishLoan(trace: WordTrace): boolean {
  return trace.source === "english";
}

// Incorrect: implicit return type, cast, non-null assertion
export function isEnglishLoan(trace) {
  return (trace as any).source! === "english";
}
```

Where a shape lives:

| Shape                                                | File                                             |
| ---------------------------------------------------- | ------------------------------------------------ |
| IndexedDB rows (`Speaker`, `Clip`, `ScriptRow`, ...) | `src/lib/db/schema.ts`                           |
| Imported sentence line, corpus pool line             | `src/lib/corpus/schema.ts`                       |
| Worker message contracts                             | `src/lib/<worker>/messages.ts`                   |
| Export line shapes                                   | `src/lib/export/<format>.ts`, next to the writer |
| Settings                                             | `src/lib/settings.ts`                            |

## 3. Application Structure

```
src/
  main.tsx                    mounts <App/>
  app.tsx                     header, speaker picker, tab bar
  features/<feature>/
    <feature>.store.ts        feature state and actions; no JSX, no DOM queries
    <feature>.view.tsx        JSX only; reads the store, renders components
    <helper>.ts               feature-local logic that is still DOM-bound (recorder.ts)
  components/<name>.tsx       one Solid component per file, styled with Kumo class strings
  lib/
    db/                       idb schema, one repository per store
    audio/                    wav-encode, trim-silence, resample, hash
    corpus/                   pool loader, coverage units, script builder
    export/                   line serializers, DatasetWriter, folder and zip writers
    g2p/                      worker message contract and main-thread client
    duration.ts  slug.ts  settings.ts
  workers/
    g2p.worker.ts  builder.worker.ts  recorder.worklet.ts
  styles/app.css
```

Dependency direction, top to bottom only:

```
components  <-  features/*.view.tsx  ->  features/*.store.ts  ->  lib/*  ->  workers (through lib/<x>/client.ts)
```

- Views hold JSX and view-local UI state (an open dialog, a hovered row). They never touch IndexedDB, `AudioContext`, `getUserMedia`, `fetch`, or a worker.
- Stores own feature state and every action. They call `lib/` and nothing above them.
- `lib/audio`, `lib/corpus`, `lib/duration.ts`, `lib/slug.ts`, and the `lib/export/*` line serializers are pure: no DOM, no IndexedDB, no globals beyond `crypto` and `TextEncoder`. `bun test` imports them directly.
- DOM-bound `lib/` files say so in the name and are not imported by tests: `lib/audio/resample.ts` (`OfflineAudioContext`), `lib/export/fs-writer.ts` (File System Access API), `lib/db/*`.
- Workers import from `lib/` only, never from `features/` or `components/`. Each worker has one typed message contract in `lib/<x>/messages.ts` and one main-thread client that wraps `postMessage` in a promise. Views and stores never call `postMessage` themselves.
- `components/` never imports from `features/`.

```typescript
// Correct: the store owns the repository call; the view renders the result.
// features/review/review.store.ts
export async function approveClip(id: string): Promise<void> {
  await clipRepository.setStatus(id, "approved");
  bumpVersion();
}

// Incorrect: IndexedDB reached from JSX.
// features/review/review.view.tsx
<button onClick={() => clipRepository.setStatus(props.id, "approved")}>Ya</button>
```

## 4. SolidJS 2.0 Rules

The app pins `solid-js@2.0.0-rc.3` and `@solidjs/web@2.0.0-rc.3`. It is a release candidate; the version is pinned exactly and bumped on purpose, never by a range. Solid 1.x patterns are rejected by `eslint-plugin-solid` with `settings.solid.version = 2` **(enforced)**.

### 4.1 Imports

| Need                                                                          | Import from    |
| ----------------------------------------------------------------------------- | -------------- |
| `render`, DOM `JSX` types, `ComponentProps`                                   | `@solidjs/web` |
| signals, memos, effects, stores, `Show`, `For`, `Loading`, `Errored`, `flush` | `solid-js`     |

`solid-js/web` and `solid-js/store` do not exist in 2.0 **(enforced)**.

### 4.2 Reactivity

- Writes apply on the microtask flush. Never read a signal right after setting it and expect the new value; in tests call `flush()`.
- `batch()`, `on()`, and `onMount()` are gone **(enforced)**. For a one-shot side effect at construction, call the function in the component body.
- `createEffect(compute, effect)` always takes two functions **(enforced)**. `compute` reads signals and returns a value. `effect(next, prev)` performs the side effect (DOM, audio, IndexedDB) and may return a cleanup. Errors from `compute` are handled by passing `{ effect, error }` as the second argument.
- Async data uses `createMemo(async () => ...)` inside `<Loading fallback>`; `<Errored fallback={(error, reset) => ...}>` catches rejections. `createResource` and `createAsync` do not exist **(enforced)**. Re-run an async memo by changing a signal it reads; every store exposes a `version` signal that its write actions bump.
- Store updates are draft mutations: `setState((draft) => { draft.a.b = value; })`. The `storePath` path form is not used.
- `snapshot(store)` returns a plain deep copy. `unwrap` does not exist.

```typescript
// Correct
createEffect(
  () => clip.status(),
  (status) => {
    if (status === "approved") announce("Klip disetujui");
  }
);

// Incorrect: Solid 1.x single-argument effect (MISSING_EFFECT_FN at runtime)
createEffect(() => {
  if (clip.status() === "approved") announce("Klip disetujui");
});
```

### 4.3 Components

- One component per file. Default export. Props type named `{ComponentName}Props`.
- Never destructure props, in the parameter list or in the body **(enforced)**. Read `props.x` inside JSX or a tracking scope.
- Defaults through `merge(defaults, props)`; forwarding through `omit(props, "a", "b")`. `mergeProps` and `splitProps` do not exist.
- Pass values, not accessors, to DOM attributes: `value={name()}`, never `value={name}` **(enforced)**.
- `class` takes the structured form for conditional classes: `class={{ "bg-kumo-tint": active() }}` or an array; no hand-built strings **(enforced, warning)**.
- No `fetch`, Zod parsing, IndexedDB, or audio API in a view file (see §3).
- Early returns and `<Show>` / `<Switch>` for conditional rendering. No nested ternaries **(enforced)**.
- Keyboard shortcuts are registered by the feature store through `lib/shortcuts.ts`, never by ad-hoc `keydown` listeners in views.

### 4.4 Styling

- Tailwind 4 utilities with Kumo tokens (`text-kumo-default`, `bg-kumo-base`, `ring-kumo-line`). Raw hex colours do not appear in source.
- `src/components/<name>.tsx` copies its variant class strings from the Kumo registry entry of the same name (`node_modules/@cloudflare/kumo/ai/component-registry.json`). Follow `.claude/skills/kumo-design/SKILL.md`: 14px content text, sentence-case headings, `font-semibold` not `font-bold`, no tracking changes.
- Dark mode is `data-mode="dark"` on `<html>` with `light-dark()` tokens. Tailwind's `dark:` variant is not used.

## 5. IndexedDB Standards

- One database, `audionesia`. The schema is a typed `DBSchema` in `src/lib/db/schema.ts`; the version number lives next to it.
- Every schema change bumps the version and adds a step to the `upgrade` callback that migrates existing rows. Never delete a store in `upgrade` without moving its rows first.
- Store names are lowercase plural nouns: `speakers`, `sentences`, `scripts`, `clips`, `audio`, `skips`, `settings`.
- One repository per store: `src/lib/db/<store>.repository.ts`. It owns every query for that store and exports async functions. No business logic here.
- Audio blobs live in the `audio` store, keyed by clip id, separate from clip metadata, so listing clips never loads audio.
- A write that touches more than one store runs in one transaction. Example: saving a clip writes `clips` and `audio`, and bumps `speakers.nextSeq`, in one `readwrite` transaction.
- `navigator.storage.persist()` is requested before the first write.
- Rows the app wrote are trusted by their schema version. Data from outside (imported files, the corpus pool, pasted text) is parsed with Zod before it reaches a repository.

```typescript
// Correct
export async function saveClip(clip: Clip, wav: Blob): Promise<void> {
  const tx = (await db()).transaction(["clips", "audio", "speakers"], "readwrite");
  await Promise.all([
    tx.objectStore("clips").put(clip),
    tx.objectStore("audio").put({ clipId: clip.id, blob: wav }),
    bumpSequence(tx.objectStore("speakers"), clip.speakerId),
    tx.done,
  ]);
}

// Incorrect: two transactions; a crash between them leaves a clip without audio.
await (await db()).put("clips", clip);
await (await db()).put("audio", { clipId: clip.id, blob: wav });
```

## 6. Testing Standards

- `bun test`. Tests live in `tests/` and mirror `src/lib/` (`tests/audio/wav-encode.test.ts`).
- Arrange-Act-Assert. One `it` per behaviour or error condition.
- Tests import pure `lib/` modules only. No DOM, no IndexedDB, no Solid rendering. Audio, DOM, and worker glue stays thin and untested; the logic behind it is pure and tested.
- No module mocking **(enforced)**. Pass dependencies as arguments instead.
- Every branch, loop, parser, or serializer ships with the smallest test that fails when the logic breaks. Trivial glue does not.
- Test data is built inline in the test. No fixture folders.

```typescript
import { describe, expect, it } from "bun:test";

import { encodeWav } from "../../src/lib/audio/wav-encode.ts";

describe("encodeWav", () => {
  it("writes a 44-byte header followed by 16-bit samples", () => {
    const bytes = encodeWav(new Float32Array([0, 1, -1]), 24000);
    expect(bytes.byteLength).toBe(44 + 3 * 2);
  });
});
```

## 7. Git Workflow

### 7.1 Branches

```
main                             protected; CI must pass
feature/<short-description>
fix/<short-description>
chore/<short-description>
```

### 7.2 Commit Messages

Conventional Commits, checked by the `commit-msg` hook **(enforced)**: `<type>(<scope>): <subject>`.

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, `style`, `build`, `revert`.

- Imperative mood.
- Subject 80 characters or fewer, including type and scope **(enforced)**.
- Never add `Co-Authored-By` or any other trailer.
- No `@` mentions in the message.

### 7.3 Pull Requests

- Feature branches target `main`. No direct pushes to `main`.
- CI (fmt, lint, type-check, test, build, dependency scan) must pass.
- Self-review against [CODE_REVIEW_CHECKLIST.md](CODE_REVIEW_CHECKLIST.md) before requesting review.
- Squash merge.

### 7.4 Hooks

`lefthook` installs on `bun install`. Pre-commit formats staged files and restages them, lints staged `.ts` / `.tsx`, and type-checks. Bypass with `--no-verify` only for a work-in-progress commit on a feature branch; CI is the real gate.

## 8. File and Folder Naming

| Item                    | Convention                            | Example                    |
| ----------------------- | ------------------------------------- | -------------------------- |
| Folders                 | `kebab-case`                          | `features/record/`         |
| TypeScript files        | `kebab-case`                          | `trim-silence.ts`          |
| Feature store           | `<feature>.store.ts`                  | `record.store.ts`          |
| Feature view            | `<feature>.view.tsx`                  | `record.view.tsx`          |
| Component               | `<name>.tsx`                          | `components/button.tsx`    |
| Repository              | `<store>.repository.ts`               | `clip.repository.ts`       |
| Web Worker              | `<name>.worker.ts`                    | `g2p.worker.ts`            |
| Audio worklet           | `<name>.worklet.ts`                   | `recorder.worklet.ts`      |
| Test                    | source name + `.test`                 | `trim-silence.test.ts`     |
| Constants               | `SCREAMING_SNAKE_CASE`                | `SILENCE_THRESHOLD_DBFS`   |
| Variables and functions | `camelCase`, verb-first for functions | `buildScripts`             |
| Types                   | `PascalCase`                          | `ClipStatus`               |
| Zod schemas             | `camelCase` + `Schema`                | `importedSentenceSchema`   |
| IndexedDB stores        | lowercase plural                      | `clips`, `audio`           |
| Dataset fields          | `snake_case` English                  | `sample_rate`, `file_name` |
| Environment variables   | `SCREAMING_SNAKE_CASE`                | `ANTHROPIC_API_KEY`        |

All code identifiers are English. UI labels are Bahasa Indonesia string literals in view files.

## 9. Code Formatting

- Formatter: `oxfmt` (`.oxfmtrc.json`) **(enforced)**.
- Linter: `oxlint` (`.oxlintrc.json`) with the vendored `anti-slop` rules and `eslint-plugin-solid` **(enforced)**.
- Pre-commit hook (`lefthook.yml`) runs both on staged files **(enforced)**.
- Files over 300 lines fail lint **(enforced)**. Split at 250.
- `tools/oxlint/anti-slop/` is vendored byte-for-byte from upstream. Update it by copying, never by editing.

## 10. Localization and User-Facing Copy

- UI strings are Bahasa Indonesia. Tab names: `Rekam`, `Dengarkan`, `Tulis`, `Dataset`, `Pengaturan`.
- No i18n library. Copy lives in the view that uses it.
- Numbers use the `id-ID` locale (`1.234,5`). Durations show one decimal and the unit: `12,3 s`.
- Dataset files, manifests, field names, and log messages are English.
- Error messages shown to the user are Bahasa Indonesia; the `Error` thrown in code carries an English message.

## 11. Audio and Dataset Invariants

These rules protect the training data. Breaking one produces a dataset that looks fine and trains badly.

- Never use `MediaRecorder`. It encodes lossy Opus. Capture raw PCM through an `AudioWorkletProcessor`.
- `getUserMedia` always sets `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false`, `channelCount: 1`.
- The clip row stores the actual `AudioContext.sampleRate` of the capture. Never assume 48000.
- `duration` is measured from the decoded PCM after trimming. The syllable-based estimate is for planning only and never reaches an export.
- Every phoneme string is stored next to the `g2pVersion` that produced it (`VERSION` from `indo-g2p`). A pool built with another version is rebuilt, not patched.
- Only clips with `status === "approved"` export. The status machine is: `pending -> approved`, `pending -> rejected`, `approved -> rejected`; `approved` and `rejected` are terminal for export purposes.
- `hash` is the first 16 hex characters of SHA-256 over the exported WAV bytes (after resampling), never over the stored master.
- `path` is `dataset/audio/<speaker>/clip_<seq>.wav` with `seq` zero-padded to four digits per speaker.
- Export formats are pure line serializers in `src/lib/export/` that take rows and return strings; one `DatasetWriter` (folder or zip) writes bytes. Serializers never touch the file system.
- StyleTTS2 lines pass through the symbol mapping (`-` to space, strip `'()`, `é` to `e`) and the symbol-table check before writing. A line over 500 phoneme characters is refused with a message, not silently truncated.
- Every export includes `manifest.json` and `ATTRIBUTION.md`. A corpus source without a license entry does not enter the pool.
- The target duration window and the syllable rate are settings with named presets, never constants in feature code.

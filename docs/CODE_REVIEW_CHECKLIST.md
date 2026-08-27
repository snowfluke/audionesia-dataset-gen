# Code Review Checklist

## Audionesia Dataset Gen

**Version:** 1.0.0  
**Date:** 2026-08-27  
**Status:** Enforced

Walk every item for every pull request. Each item holds, or it is a finding. Items tagged **(CI)** are checked by the gate; confirm the run is green and move on. Section numbers refer to [CODING_STANDARD.md](CODING_STANDARD.md).

## 1. Gate

- [ ] **(CI)** `bun run complete-check` is green on the branch head (§ intro).
- [ ] **(CI)** No file over 300 lines; nothing new between 250 and 300 without a split plan (§1, §9).
- [ ] The PR has one intent. Unrelated changes are split out (§7.3).

## 2. Scope and structure

- [ ] Every new file sits where §3 says: `features/<feature>/*.store.ts` or `*.view.tsx`, `components/<name>.tsx`, `lib/<area>/`, `workers/`.
- [ ] Dependency direction holds: view -> store -> lib -> worker client. No view touches IndexedDB, audio APIs, `fetch`, or `postMessage` (§3).
- [ ] Pure `lib/` modules stay pure: no DOM, no IndexedDB, no `window` (§3). DOM-bound modules say so in their name.
- [ ] Workers import from `lib/` only and speak through the typed contract in `lib/<x>/messages.ts` (§3).
- [ ] No new dependency where the platform, the standard library, or an installed package already does the job (§1).
- [ ] A shortcut is marked `// ponytail:` with its ceiling and upgrade path (§1).

## 3. TypeScript

- [ ] **(CI)** No `any`, no `!`, no `as` without a `// SAFETY:` comment, `import type` separated, explicit return types on exports (§2.2).
- [ ] Enum-like values are string literal unions (§2.2).
- [ ] Data from outside the app (imported files, corpus pool, settings) is parsed with a Zod schema, and the TypeScript type is `z.infer<>` of it (§2.2).
- [ ] No promise is left detached; `await` or `.catch(reportError)` (§2.2).

## 4. SolidJS 2.0

- [ ] **(CI)** No Solid 1.x API: `solid-js/web`, `solid-js/store`, `batch`, `on`, `onMount`, `createResource`, `createAsync`, `mergeProps`, `splitProps`, `unwrap` (§4.1, §4.2).
- [ ] **(CI)** Every `createEffect` has a compute function and an effect function (§4.2).
- [ ] **(CI)** Props are not destructured; DOM attributes receive values, not accessors (§4.3).
- [ ] Async reads use `createMemo(async ...)` inside `<Loading>` with an `<Errored>` boundary, and re-run through a `version` signal (§4.2).
- [ ] Store writes use draft mutation, not `storePath` (§4.2).
- [ ] One component per file, default export, `{Name}Props` type (§4.3).
- [ ] Keyboard shortcuts go through `lib/shortcuts.ts` (§4.3).
- [ ] Classes use Kumo tokens; no raw hex colours; `font-semibold` not `font-bold`; 14px content text (§4.4).

## 5. IndexedDB

- [ ] A schema change bumps the version and migrates rows in `upgrade` (§5).
- [ ] Every query lives in the store's repository file (§5).
- [ ] A write touching more than one store uses one transaction (§5).
- [ ] Audio blobs go to the `audio` store, never onto the clip row (§5).

## 6. Audio and dataset invariants

- [ ] No `MediaRecorder`. Capture goes through the worklet with the four `getUserMedia` constraints off (§11).
- [ ] The clip row stores the real capture `sampleRate`; `duration` is measured, never estimated (§11).
- [ ] Every stored phoneme string has a `g2pVersion` next to it (§11).
- [ ] Export code filters on `status === "approved"` (§11).
- [ ] `hash` comes from the exported bytes; `path` follows `dataset/audio/<speaker>/clip_<seq>.wav` (§11).
- [ ] Line serializers are pure and tested; only the `DatasetWriter` writes bytes (§11).
- [ ] StyleTTS2 output passes the symbol mapping and length check (§11).
- [ ] Every corpus source carries a license entry and appears in `ATTRIBUTION.md` (§11).
- [ ] Duration window and syllable rate are settings, not constants (§11).

## 7. Tests

- [ ] Every new branch, loop, parser, or serializer has a test that fails when the logic breaks (§6).
- [ ] Tests import pure modules only; no DOM, no IndexedDB, no rendering (§6).
- [ ] **(CI)** No module mocking (§6).
- [ ] Arrange-Act-Assert, one `it` per behaviour (§6).

## 8. Copy and naming

- [ ] UI strings are Bahasa Indonesia in view files; identifiers, dataset fields, and logs are English (§8, §10).
- [ ] File names follow the §8 table (`*.store.ts`, `*.view.tsx`, `*.repository.ts`, `*.worker.ts`, `*.worklet.ts`, `*.test.ts`).
- [ ] Numbers and durations use the `id-ID` format in the UI (§10).

## 9. Commits and docs

- [ ] **(CI)** Conventional Commits subject, 80 characters or fewer (§7.2).
- [ ] No `Co-Authored-By` trailer, no `@` mentions (§7.2).
- [ ] A behaviour change that a standard describes updates `docs/CODING_STANDARD.md` in the same PR (§7.3).
- [ ] `CLAUDE.md` still tells the truth after the change (repo layout, commands, invariants).

# Accuracy

State what you can verify. Mark everything else.
Tag load-bearing claims with confidence: high, moderate, low, unknown.
Say "I don't know" and stop. Do not fill gaps with plausible detail.
Cite sources for figures, dates, quotes, and names.
Search when a claim is current, contested, or after your cutoff.
Show the arithmetic for any number you produce.
Form your own estimate before you use mine. Compare both.

# Directness

Tell me when I am wrong. Do it in the first sentence.
Start with the answer. Skip praise and preamble.
Deliver bad news plain.
Hold your position when I push back. Change it for new evidence or a better argument.
Keep caveats that change my decision. Cut the rest.
Do not soften, hedge, or moralize unless I ask.

# Reasoning

Reason step by step on hard problems before you conclude.
State the strongest objection to your own conclusion. Then answer it.
Separate what you know from what you infer.

# Format

Match length to the question.
Write prose. Use lists for real lists.
Follow ASD-STE100: one instruction per sentence, active voice, simple tenses, 20 words maximum.
Use the /ste100 skill for manuals and specifications.

# Ambiguity

Ask one question when the request is unclear and a wrong answer is costly.
Otherwise state your assumption and proceed.

# Code quality

Write for the next person who opens the file. Do not over-comment code. Clean code does not need comments.
Reuse an existing function before you write a new one.
Keep each function to one job.
Type every interface, API contract, and data shape.
Handle errors at the boundary. Do not swallow them.
Name the technical debt you create. Say what would clear it.
State the trade-off when you choose speed over structure.
Skip this rigor for throwaway scripts. Tell me when you skip it.

# Continuity

Read the existing code before you extend it. Match its patterns.
Keep names, structure, and conventions stable across the session.
Edit the existing file. Do not regenerate it from scratch.
Show the changed block. Do not repeat unchanged code.
Ask for the current file when your copy may be stale.

# State machines

Define an explicit state machine for anything with a status.
List every state. List every legal transition.
Name the actor and the guard condition for each transition.
Reject any transition that no rule allows.
Show the machine as a table before you write the code.
Name the terminal states.

# Implementation

- Do not preserve backwards compatibility unless the docs say so.
- Choose the simplest implementation that fully meets the current requirements. Do not over-engineer.
- Prefer established, well-maintained libraries over custom implementations.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

## AI Agent Instructions: Audionesia Dataset Gen

> **CRITICAL:** These rules are non-negotiable. Context compaction does not exempt you. Re-read this file if context was truncated. Run `bun run complete-check` (type-check, lint, fmt, test, build) before marking any task complete. A change to recording, review, or export also needs `bun run smoke` against a running `bun run dev`.

> **Source of truth:**
>
> - `docs/CODING_STANDARD.md` for every rule restated here; the standard wins on conflict.
> - `docs/CODE_REVIEW_CHECKLIST.md` for what a review walks.
> - `README` of `indo-g2p` (`node_modules/indo-g2p/README.md`, `docs/agents.md`) for the phonemizer contract.
> - `.claude/skills/kumo-design/SKILL.md` for styling rules.
> - `public/corpus/index.json` and `ATTRIBUTION.md` for what text ships and under which license.

## Project Overview

**Audionesia** is a static SolidJS 2.0 web app that builds an Indonesian text-to-speech training dataset. It ships a phoneme-balanced reading corpus, records raw PCM in the browser, stores everything in IndexedDB, and exports the `dataset/` layout plus StyleTTS2 and PocketTTS manifests. There is no server. GitHub Pages hosts the built `dist/`.

| Layer      | Tech                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| Runtime    | Bun 1.4 (tooling, scripts, tests)                                                             |
| Language   | TypeScript 7.0.2, strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`            |
| Framework  | `solid-js` 2.0.0-rc.3 + `@solidjs/web` 2.0.0-rc.3 (release candidate, pinned exact)           |
| Bundler    | Vite 8.2.2 + `@solidjs/vite-plugin` 3.0.0-next.34, workers as ES modules                      |
| Styling    | Tailwind CSS 4.3.3 + `@cloudflare/kumo` 2.12.0 tokens (CSS only; Kumo's React code is unused) |
| Storage    | IndexedDB through `idb` 8, database `audionesia`                                              |
| Validation | `zod` 4 at trust boundaries only                                                              |
| Phonemes   | `indo-g2p` 0.1.2 (full entry) inside a Web Worker; pool pre-phonemized offline                |
| Export     | File System Access API (prunes stale WAVs), `fflate` ZIP fallback                             |
| ASR check  | `@huggingface/transformers` 4.2 Whisper in a worker, loaded on first use only                 |
| Quality    | `oxlint` 1.80 (+ vendored anti-slop, `eslint-plugin-solid` v2 rules), `oxfmt` 0.65, lefthook  |
| Smoke      | Playwright driving system Google Chrome with a fake microphone                                |

**Repository layout:**

```
audionesia-dataset-gen/
  index.html                       # Vite entry, loads src/main.tsx
  src/
    main.tsx  app.tsx              # mount; header, speaker picker, tabs, help dialogs
    components/                    # one Solid component per file, Kumo class strings
    features/
      record/   review/   write/   # Rekam, Dengarkan, Tulis: <feature>.store.ts + .view.tsx
      dataset/  settings/          # Dataset (stats, export), Pengaturan (knobs)
      speakers/ library/           # global stores: speakers, pool seeding, script build
    lib/
      asr/                         # Whisper worker client, clip check with character error rate
      audio/                       # wav-encode, trim-silence (SNR), level, normalize, resample, playback
      backup/                      # database backup and restore (folder or ZIP)
      corpus/                      # schema, filter, split, coverage, script-builder, pool-loader, import
      db/                          # idb schema + one repository per store
      export/                      # manifest serializers, styletts2-symbols, writer, export
      g2p/                         # worker message contract + client
      text/                        # normalizeForCer, levenshtein, characterErrorRate
      duration.ts hash.ts settings.ts shortcuts.ts slug.ts theme.ts format.ts worker-rpc.ts
    workers/                       # g2p.worker.ts, builder.worker.ts, asr.worker.ts, recorder.worklet.ts
    styles/app.css                 # @import "tailwindcss" then Kumo tokens
  public/corpus/                   # pool.jsonl, index.json, ATTRIBUTION.md (generated, committed)
  corpus/sources.json              # news feeds for scrape-news; corpus/raw/ is gitignored
  scripts/corpus/                  # fetch-*, scrape-news, generate-llm, build-corpus
  scripts/smoke.ts                 # browser smoke test (bun run smoke)
  tests/                           # bun test, mirrors src/lib
  tools/oxlint/anti-slop/          # vendored lint rules, never edited
  docs/ .claude/skills/ .github/workflows/
```

## Boundaries

**Tabs (Bahasa Indonesia):** `Rekam` (record), `Dengarkan` (review), `Tulis` (add text), `Dataset` (stats, export), `Pengaturan` (settings).

**Clip status machine** (`src/lib/db/schema.ts`):

| From       | To         | Actor              | Guard                       |
| ---------- | ---------- | ------------------ | --------------------------- |
| (take)     | `pending`  | `saveClip`         | PCM trimmed, duration known |
| `pending`  | `approved` | reviewer (`Ya`)    | none                        |
| `pending`  | `rejected` | reviewer (`Tidak`) | none                        |
| `approved` | `rejected` | reviewer           | none                        |
| any        | (deleted)  | `deleteClip`       | audio row deleted with it   |

Terminal for export: `approved` exports, `rejected` never does. Script status per speaker is derived from clips and skips, never stored.

**Data flow:** `scripts/corpus/build-corpus.ts` (offline) -> `public/corpus/pool.jsonl` -> seeded into IndexedDB on first run -> `builder.worker.ts` builds scripts -> Rekam saves clips + WAV masters -> Dengarkan approves -> `lib/export` resamples, hashes, and writes.

## Work Model

Single developer. Work lands on `main` through feature branches and PRs; there is no sprint board. The approved build plan lives outside the repo (`~/.claude/plans/cryptic-wandering-zebra.md`); the repo docs are the durable record.

## Architecture Laws

### File size: MAX 300 lines

- Enforced by oxlint `max-lines`. Split proactively at 250.
- Split into sibling files in the same folder (`record.store.ts` -> `record.store.ts` + `record.batch.ts`). No `utils` buckets.

### Layering

```
components  <-  features/*.view.tsx  ->  features/*.store.ts  ->  lib/*  ->  workers (via lib/<x>/client.ts)
```

- Views hold JSX and view-local state. No IndexedDB, audio API, `fetch`, or `postMessage` in a view.
- Feature stores own state and actions. Global stores (`speakers`, `settings`, `library`) are module-level signals; per-tab stores are `create<Feature>Store()` factories called in the view so `createMemo` and `onCleanup` have an owner.
- `lib/audio` (except `resample.ts`, `playback.ts`), `lib/corpus` (except `pool-loader.ts`), `lib/export/manifest.ts`, `lib/export/styletts2-symbols.ts`, `lib/duration.ts`, `lib/hash.ts`, `lib/slug.ts` are pure and tested with `bun test`. Keep DOM out of them.
- Workers import from `lib/` only. One typed message contract per worker; the main thread goes through `callWorker` in `lib/worker-rpc.ts`.
- `components/` never imports from `features/`.

### Trust boundaries

Parse with Zod: dropped or pasted files (`lib/corpus/import.ts` + `filter.ts`), the corpus pool (`pool-loader.ts`), raw corpus lines (`build-corpus.ts`), persisted settings (`settings.repository.ts`). Rows the app wrote itself are trusted by schema version.

## SolidJS 2.0 (not 1.x)

| Use                                                     | Never                                                    |
| ------------------------------------------------------- | -------------------------------------------------------- |
| `import { render } from "@solidjs/web"`                 | `solid-js/web`, `solid-js/store` (do not exist in 2.0)   |
| `createEffect(compute, effect)` two functions           | single-argument `createEffect`, `onMount`, `on`, `batch` |
| `createMemo(async () => ...)` inside `<Loading>`        | `createResource`, `createAsync`                          |
| `<Errored fallback={(error, reset) => ...}>`            | `<ErrorBoundary>`, `<Suspense>`                          |
| `merge(defaults, props)`, `omit(props, "a")`            | `mergeProps`, `splitProps`, destructured props           |
| `class={[BASE, VARIANT, { "x": cond() }]}`              | hand-built class strings                                 |
| `aria-*="true"/"false"` strings                         | boolean aria values                                      |
| a `version` signal bumped after writes to re-run memos  | manual refetch helpers                                   |
| `attempt(task)` from `components/toast.tsx` in handlers | `.then()` / `.catch()` chains, unreported failures       |

`jsxImportSource` is `@solidjs/web`. Writes apply on the microtask flush; tests call `flush()` before reading.

## Bun Runtime (not Node)

| Use                               | Do not use               |
| --------------------------------- | ------------------------ |
| `bun install`, `bun run <script>` | `npm`, `yarn`, `pnpm`    |
| `bun test`                        | `jest`, `vitest`         |
| `bun scripts/corpus/<x>.ts`       | `node`, `ts-node`        |
| `Bun.file`, `Bun.write`, `Bun.$`  | `node:fs`, `execa`       |
| `oxlint`, `oxfmt`                 | ESLint, Prettier         |
| Vite dev server (`bun run dev`)   | `Bun.serve` HTML imports |

## Verification Gate

Run before marking any task complete:

```bash
bun run type-check      # tsc on src, then scripts + tests
bun run lint            # oxlint src tests scripts
bun run fmt             # oxfmt --check
bun test
bun run build
bun run complete-check  # all five
bun run smoke           # with `bun run dev` running; screenshots in .smoke/
```

## Code Discovery Protocol

1. `grep -r "pattern" src/` before writing a function.
2. Read the sibling feature (`features/review/` mirrors `features/record/`) and match it.
3. Check `src/lib/` and `src/components/` before adding a helper or a widget.
4. Check `src/lib/db/schema.ts` and `src/lib/corpus/schema.ts` for the type before declaring a new one.

## Naming

| Element            | Pattern                    | Example                    |
| ------------------ | -------------------------- | -------------------------- |
| Files, folders     | kebab-case                 | `trim-silence.ts`          |
| Feature store/view | `<f>.store.ts/.view.tsx`   | `record.store.ts`          |
| Repository         | `<store>.repository.ts`    | `clip.repository.ts`       |
| Worker / worklet   | `*.worker.ts/*.worklet.ts` | `g2p.worker.ts`            |
| Functions          | camelCase, verb-first      | `buildScripts`             |
| Types              | PascalCase                 | `ClipStatus`               |
| Constants          | SCREAMING_SNAKE            | `SILENCE_THRESHOLD_DBFS`   |
| Zod schemas        | camelCase + Schema         | `poolSentenceSchema`       |
| IndexedDB stores   | lowercase plural           | `clips`, `audio`, `units`  |
| Dataset fields     | snake_case English         | `sample_rate`, `file_name` |

Identifiers English. UI copy Bahasa Indonesia, in view files. Thrown `Error` messages that reach the user are Bahasa Indonesia; internal ones English.

## Type Safety

- No `any`, no `!`, no `as` without a `// SAFETY:` line, `catch (cause: unknown)`, explicit return types on exports. All enforced.
- Typed arrays that cross into Web APIs are `Float32Array<ArrayBuffer>` / `Uint8Array<ArrayBuffer>`, not the `ArrayBufferLike` default.
- Dictionaries are `Map`, not `Record<string, unknown>`.

## Audio and Dataset Invariants

- Never `MediaRecorder`. Capture through `recorder.worklet.ts`; `getUserMedia` has echo cancellation, noise suppression, and auto gain **off**, mono.
- Store the real capture `sampleRate` on the clip. `durationSec` is measured from trimmed PCM.
- Master WAV: 16-bit mono at capture rate, silence trimmed (`-45 dBFS`, `150 ms` padding, both settings). Export resamples to `settings.exportSampleRate` (default 24000).
- `hash` = first 16 hex of SHA-256 of the **exported** WAV bytes. `path` = `dataset/audio/<speaker>/clip_<seq 4 digits>.wav`. Train/validation = `splitFor(clipId)`, a hash of the clip id, never a position.
- Export removes DC offset and normalizes the peak to `settings.normalizePeakDbfs` (default -3, null keeps the master level); clips under `settings.minClipSec` are skipped; `licenseMode: "cc0"` keeps only clips whose sentences all come from `CC0_SOURCES`.
- `speakers.jsonl` line = `{"hash","path","text","phonemes","duration","speaker"}` exactly; extra formats are separate files.
- StyleTTS2: map `-` to space, strip `'()`, `é` to `e`, refuse lines over 500 phoneme chars, skip speakers with fewer than 2 clips, `speaker_id` = creation index, `root_path` = `dataset/`. PocketTTS: `{"path","duration","transcript"}` with 30 s max.
- Every phoneme string travels with its `g2pVersion`; clips freeze `text` and `phonemes` at record time.
- Script id = hash of its sentence ids; `rebuildScripts` keeps old scripts that clips still reference, so a clip never dangles. Scripts never mix text sources (`DEFAULT_SAME_SOURCE_TOLERANCE = 0`).
- Seeding is complete only when the `library` row in `settings` matches the served `index.json` (`poolCount`, `g2pVersion`); a mismatch reseeds and remaps Tulis sentences onto the new unit table.
- A clipped take cannot be saved while `settings.rejectClipped` is on; `snrDb` comes from the leading silence of the take.
- StyleTTS2 `speaker_id` = index in `createdAt` order (`listSpeakers` sorts); speakers carry optional gender, age range, dialect, microphone, and `consentAt`.
- Coverage units are `p:<phone>`, `d:<a>.<b>` (with `#` boundary), `f:<phenomenon>`; ids index the `units` store and `index.json`.
- Duration window and syllable rate are settings with presets (`pocket-tts` 10-30 s, `styletts2` 5-15 s). Default `syllablesPerSecond` 4.5 is a calibration knob, fitted from approved clips.

## Testing

- `bun test`, files under `tests/` mirroring `src/lib`. Arrange-Act-Assert, one `it` per behaviour, no module mocks, no DOM.
- Every new branch, parser, serializer, or loop ships with the smallest failing test. `tests/export/styletts2-symbols.test.ts` scans the committed pool for symbols StyleTTS2 would drop.
- Browser behaviour is checked by `bun run smoke`, not unit tests.

## Database

- Schema and version in `src/lib/db/schema.ts`; every change bumps `DB_VERSION` and adds a migration step in `database.ts`.
- One repository per store; multi-store writes in one transaction (`saveClip` writes `clips`, `audio`, `speakers` together).
- Audio blobs live only in `audio`, keyed by clip id.

## Git

- Conventional Commits, subject 80 chars max, imperative, no `Co-Authored-By`, no `@` mentions. The `commit-msg` hook enforces format and length.
- Pre-commit (lefthook): `oxfmt` on staged files (restaged), `oxlint` on staged `.ts/.tsx`, `bun run type-check`.
- `main` is protected; CI (`.github/workflows/ci.yml`) runs fmt, lint, type-check, test, build, and an OSV scan. `pages.yml` deploys `dist/` on push to `main` with `BASE_PATH=/<repo>/`.

## Absolute Prohibitions

| Violation                                       | Why                                                    |
| ----------------------------------------------- | ------------------------------------------------------ |
| `MediaRecorder`, browser audio processing on    | Lossy or altered audio ruins training data             |
| Solid 1.x APIs (`solid-js/web`, `onMount`, ...) | Do not exist in 2.0; lint blocks them                  |
| `@solidjs/router` or any router                 | Tabs are state                                         |
| Kumo React components                           | React-only; only its CSS tokens are used               |
| Editing `public/corpus/*` by hand               | Generated by `bun run corpus:build`                    |
| Editing `tools/oxlint/anti-slop/*`              | Vendored byte-for-byte; update by copying upstream     |
| Committing `corpus/raw/`, `.smoke/`, `dist/`    | Downloads and build output                             |
| Exporting non-`approved` clips                  | Dataset quality gate                                   |
| Estimated durations in any manifest             | Only measured `durationSec` leaves the app             |
| Files over 300 lines, `any`, `!`, bare `as`     | Lint fails                                             |
| `// TODO` without an issue, `// simplified`     | Ship complete code; mark shortcuts with `// ponytail:` |

## Context Recovery Checklist

If context was compacted, re-verify:

- [ ] Solid **2.0 RC** (`2.0.0-rc.3`), `jsxImportSource: "@solidjs/web"`, two-argument `createEffect`, async `createMemo` + `<Loading>`/`<Errored>`.
- [ ] No router. Five tabs: Rekam, Dengarkan, Tulis, Dataset, Pengaturan.
- [ ] Raw PCM via AudioWorklet; `getUserMedia` constraints off; master WAV at capture rate; export at `exportSampleRate`.
- [ ] `hash` from exported bytes, 16 hex; `path` `dataset/audio/<speaker>/clip_0001.wav`; `speakers.jsonl` shape fixed.
- [ ] Only `approved` clips export; StyleTTS2 needs 2 clips per speaker and lines under 500 chars; PocketTTS max 30 s.
- [ ] Pool is generated offline (`corpus:*` then `corpus:build`) and committed under `public/corpus/`; `corpus/raw/` is not.
- [ ] `g2pVersion` stamped on pool rows, scripts, and clips; script ids hash their sentence ids.
- [ ] IndexedDB `audionesia` v1 stores: speakers, sentences, scripts, clips, audio, skips, settings (`app` + `library` rows), units.
- [ ] Train/validation split hashes the clip id; speakers order by `createdAt`; rebuilds keep referenced scripts; scripts are single-source.
- [ ] Backup = speakers, clips + master WAVs, skips, settings, Tulis sentences (`lib/backup`); restore merges, never overwrites.
- [ ] ASR check = Whisper in `asr.worker.ts`, 16 kHz input, CER via `lib/text/cer.ts`, results on `clip.asrCer` / `clip.asrText`.
- [ ] Settings presets: `pocket-tts` 10-30 s (default), `styletts2` 5-15 s; syllable rate 4.5 default, fitted per speaker.
- [ ] Kumo look, hand-rolled Solid components; `data-mode` dark mode; 14 px body text, sentence-case headings, `font-semibold`.
- [ ] UI Bahasa Indonesia; identifiers, dataset fields, and logs English.
- [ ] Gate: `bun run complete-check`; browser: `bun run smoke` with `bun run dev` up.

## Quick Reference

```bash
bun install                    # also installs lefthook hooks
bun run dev                    # http://localhost:5173
bun run build                  # dist/
bun run preview

bun run complete-check         # type-check + lint + fmt + test + build
bun run smoke                  # Playwright + Chrome fake mic; needs bun run dev
bun run banner                 # re-render assets/banner.png from the pool

bun run corpus:common-voice    # CC0 Common Voice sentences -> corpus/raw/
bun run corpus:tatoeba         # CC-BY Tatoeba sentences with attribution
bun run corpus:wikipedia 500   # random id.wikipedia intros (CC-BY-SA)
bun run corpus:news 60         # feeds in corpus/sources.json via ax
bun run corpus:llm 5           # Claude Opus 5 paragraphs for uncovered units (ANTHROPIC_API_KEY)
bun run corpus:build           # -> public/corpus/{pool.jsonl,index.json,ATTRIBUTION.md}
```

![Audionesia](https://raw.githubusercontent.com/snowfluke/audionesia-dataset-gen/main/assets/banner.png)

[![CI](https://github.com/snowfluke/audionesia-dataset-gen/actions/workflows/ci.yml/badge.svg)](https://github.com/snowfluke/audionesia-dataset-gen/actions/workflows/ci.yml) [![Live app](https://img.shields.io/badge/app-GitHub%20Pages-2a78d6)](https://snowfluke.github.io/audionesia-dataset-gen/) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

Build an Indonesian text-to-speech training dataset in the browser. Audionesia Dataset Generator ships a phoneme-balanced reading corpus, records raw PCM from the microphone, keeps everything in IndexedDB, and exports the `dataset/` layout that StyleTTS2 and PocketTTS training expect. No server, no account: open the page and record.

```text
{"hash":"61455d3da0556e62","path":"dataset/audio/budi/clip_0001.wav","text":"Tak seorang pun boleh ditangkap.","phonemes":"taʔ səoraŋ pun boleh ditaŋkap.","duration":3.727,"speaker":"budi"}
```

## What it does

The home page lists datasets as folders. Each dataset has a name, one speaker, a target in hours, and a progress bar of approved recording time. Open a dataset to work in its tabs:

| Tab            | Job                                                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Rekam`        | One script at a time, microphone picker, level meter, raw capture with browser audio processing off, silence trim, waveform of the take. Scripts built from your own text come first.  |
| `Dengarkan`    | Review card with play/pause, waveform, `Ya` / `Tidak`, re-queue, ASR check; below it every clip of the dataset with status filters, text search, and pages.                            |
| `Teks sendiri` | Paste or drop your own text (`.txt`, `.tsv`, `.jsonl`, sample files to download); it is filtered, phonemized, added to the pool, and its scripts go to the front of the `Rekam` queue. |
| `Dataset`      | Progress toward the dataset's target, coverage of phones, diphones, and spelling phenomena, export with a preview of the folder tree, ASR check of all pending clips.                  |
| `Pengaturan`   | Trainer presets, duration window, silence and clipping gates, export sample rate and peak level, speech-rate calibration, ASR model.                                                   |

Scripts are built by a greedy set cover over the pool's coverage units, so the rarest sounds are read first; each script stays within one text source so it reads as one voice. Phonemes come from [indo-g2p](https://github.com/snowfluke/indo-g2p), and every phoneme string is stored with the library version that produced it.

## Before you record

- **StyleTTS2** ships an English-only PL-BERT ("it probably does not work very well on other languages", per its README). Train or find an Indonesian PL-BERT before fine-tuning on this dataset. StyleTTS2 also crops training audio to 5 s by default and rejects phoneme strings over 512 tokens, so the `StyleTTS2 (5-15 s)` preset is the default.
- **PocketTTS** has no Indonesian model; its new-language path needs an Indonesian tokenizer and a forced aligner (see its `training/README.md`), and its authors size such a run at 100 hours or more. Pick the `PocketTTS (10-30 s)` preset in `Pengaturan` and rebuild scripts before recording for it.
- **Licensing.** Only Common Voice (CC0) and generated text are free of obligations. Tatoeba text is CC BY 2.0 FR and Wikipedia text is CC BY-SA 4.0; a dataset or model built on them carries attribution and, for BY-SA, share-alike questions. `Pengaturan` has a CC0-only export mode, and every export writes `ATTRIBUTION.md`.
- **Back up.** Browsers can evict local storage. The home page backs up every dataset with its clips' master audio to a folder or ZIP and restores them on any machine.

## Quickstart

Prerequisites: [Bun](https://bun.sh) 1.4 or newer. Google Chrome only for `bun run smoke` and `bun run banner`.

```bash
git clone git@github.com:snowfluke/audionesia-dataset-gen.git
cd audionesia-dataset-gen
bun install              # also installs the git hooks
bun run dev              # http://localhost:5173
```

The first load seeds the bundled pool (30,071 phonemized entries) into IndexedDB and builds the scripts; a redeployed pool reseeds itself. Create a dataset (name, speaker name, target hours, optional gender, age range, dialect, microphone, and the consent checkbox), allow the microphone, press Space.

Verify a change:

```bash
bun run complete-check   # type-check, lint, fmt, test, build
bun run smoke            # Playwright drives Chrome through record, review, export, backup; needs bun run dev
```

## Export layout

Each export covers one dataset, so one speaker. Two datasets exported into the same folder overwrite each other's `speakers.jsonl` and `manifest.json`; use one folder per dataset or merge the JSONL files yourself.

```
dataset/
  audio/<speaker>/clip_0001.wav    # mono 16-bit, 24 kHz by default, DC removed, peak -3 dBFS
  speakers.jsonl                   # {"hash","path","text","phonemes","duration","speaker"}
  metadata.jsonl                   # Hugging Face audiofolder (file_name, text, phonemes, speaker, duration, split)
  styletts2/train_list.txt         # path|phonemes|speaker_id, plus val_list.txt and sentence-level OOD_texts.txt
  pocket-tts/train.jsonl           # {"path","duration","transcript"}, plus valid.jsonl
  manifest.json                    # sample rate, counts, g2p versions, speakers with metadata, warnings count
  export-warnings.txt              # every clip a trainer would reject, with the reason
  ATTRIBUTION.md                   # license and credit for every text source used
```

`hash` is the first 16 hex characters of the SHA-256 of the exported WAV. Train/validation membership is a hash of the clip id, so it never changes between exports. Only approved clips export; clips shorter than the minimum, or whose text is not CC0 in CC0 mode, are skipped and listed. On Chromium the app writes straight into a folder you pick and prunes WAVs of clips that no longer exist; other browsers get a ZIP.

## Quality gates

- Clipped takes cannot be saved (switchable). Each take shows its peak and the signal-to-noise ratio of the leading silence.
- Takes stop themselves after 90 s; a disconnected microphone or a paused audio context aborts the take with a message.
- The in-browser ASR check runs Whisper (`onnx-community/whisper-base` by default, WebGPU when available) on a clip or on every pending clip and flags transcripts that differ from the script by more than 20%.

## Corpus

The pool under `public/corpus/` is generated, committed, and rebuilt with:

```bash
bun run corpus:common-voice    # 6,344 CC0 sentences from the Common Voice repository
bun run corpus:tatoeba         # 28,192 CC-BY sentences with per-sentence attribution
bun run corpus:wikipedia 2000  # random id.wikipedia intros, CC-BY-SA
bun run corpus:news 200        # feeds listed in corpus/sources.json, read through the ax CLI
bun run corpus:llm 5           # Claude-written paragraphs for the least-covered units (ANTHROPIC_API_KEY)
bun run corpus:build           # normalize, filter, dedup, phonemize -> pool.jsonl, index.json, ATTRIBUTION.md
```

The build drops fragments under four words and lines that indo-g2p reads mostly as English. `corpus/raw/` is not committed. The current pool holds 30,071 entries, 989 coverage units, and about 52 hours of reading text; `public/corpus/ATTRIBUTION.md` lists what each source requires of a derived dataset.

## Repository map

```
audionesia-dataset-gen/
├── src/
│   ├── app.tsx  main.tsx        # shell: header, home page or workspace tabs, help dialogs
│   ├── components/              # Kumo-styled Solid components, one per file
│   ├── features/                # workspaces, record, review, write, dataset, settings, library
│   ├── lib/                     # audio, asr, backup, corpus, db, export, g2p, text: pure logic and repositories
│   └── workers/                 # G2P worker, script-builder worker, ASR worker, recorder worklet
├── public/corpus/               # generated pool (committed)
├── scripts/corpus/              # fetch and build scripts
├── scripts/smoke.ts             # browser smoke test
├── tests/                       # bun test, mirrors src/lib
├── docs/                        # coding standard, review checklist
└── .claude/skills/              # solidjs-2 and kumo-design skills for agents
```

Stack: SolidJS 2.0 (release candidate, pinned), Vite 8, Tailwind CSS 4 with Cloudflare Kumo tokens, `idb`, `zod`, `fflate`, `indo-g2p`, `@huggingface/transformers` (ASR only); Bun, oxlint, oxfmt, lefthook.

## Documentation

- [`CLAUDE.md`](./CLAUDE.md): the operating manual, invariants, and every command.
- [`docs/CODING_STANDARD.md`](./docs/CODING_STANDARD.md) and [`docs/CODE_REVIEW_CHECKLIST.md`](./docs/CODE_REVIEW_CHECKLIST.md).
- [`.claude/skills/solidjs-2/`](./.claude/skills/solidjs-2/SKILL.md): Solid 2.0 API and migration reference.

## Deploy

`.github/workflows/pages.yml` builds and publishes `dist/` on every push to `main`. Enable it once under Settings > Pages > Source: GitHub Actions.

## License

MIT. Text sources keep their own licenses: Common Voice sentences are CC0, Tatoeba sentences are CC BY 2.0 FR, Wikipedia text is CC BY-SA 4.0, VOA Indonesia reporting is public domain. The export writes `ATTRIBUTION.md` next to the audio so a published dataset carries them.

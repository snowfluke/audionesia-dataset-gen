![Audionesia](https://raw.githubusercontent.com/snowfluke/audionesia-dataset-gen/main/assets/banner.png)

[![CI](https://github.com/snowfluke/audionesia-dataset-gen/actions/workflows/ci.yml/badge.svg)](https://github.com/snowfluke/audionesia-dataset-gen/actions/workflows/ci.yml) [![Live app](https://img.shields.io/badge/app-GitHub%20Pages-2a78d6)](https://snowfluke.github.io/audionesia-dataset-gen/) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

Build an Indonesian text-to-speech training dataset in the browser. Audionesia ships a phoneme-balanced reading corpus, records raw PCM from the microphone, keeps everything in IndexedDB, and exports the `dataset/` layout that StyleTTS2 and PocketTTS training expect. No server, no account: open the page and record.

```text
{"hash":"61455d3da0556e62","path":"dataset/audio/budi/clip_0001.wav","text":"Tak seorang pun boleh ditangkap.","phonemes":"taʔ səoraŋ pun boleh ditaŋkap.","duration":3.727,"speaker":"budi"}
```

## What it does

| Tab          | Job                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `Rekam`      | Reads one 10 to 30 s script at a time, records with browser audio processing off, trims silence.     |
| `Dengarkan`  | Plays each pending clip; `Ya` approves, `Tidak` rejects. Only approved clips export.                 |
| `Tulis`      | Paste or drop your own text (`.txt`, `.tsv`, `.jsonl`); it is phonemized and added to the pool.      |
| `Dataset`    | Coverage of phones, diphones, and spelling phenomena; per-speaker counts; export to folder or ZIP.   |
| `Pengaturan` | Duration window presets per trainer, silence threshold, export sample rate, speech-rate calibration. |

Scripts are built by a greedy set cover over the pool's coverage units, so the rarest sounds are read first. Phonemes come from [indo-g2p](https://github.com/snowfluke/indo-g2p), the same library used at export time, and every phoneme string is stored with the library version that produced it.

## Quickstart

Prerequisites: [Bun](https://bun.sh) 1.4 or newer. Google Chrome only for `bun run smoke` and `bun run banner`.

```bash
git clone git@github.com:snowfluke/audionesia-dataset-gen.git
cd audionesia-dataset-gen
bun install              # also installs the git hooks
bun run dev              # http://localhost:5173
```

The first load seeds the bundled pool (35,753 phonemized entries) into IndexedDB and builds the scripts. Create a speaker, allow the microphone, press Space.

Verify a change:

```bash
bun run complete-check   # type-check, lint, fmt, test, build
bun run smoke            # Playwright drives Chrome through record, review, export; needs bun run dev
```

## Export layout

```
dataset/
  audio/<speaker>/clip_0001.wav    # mono 16-bit, 24 kHz by default
  speakers.jsonl                   # {"hash","path","text","phonemes","duration","speaker"}
  metadata.jsonl                   # Hugging Face audiofolder (file_name, text, phonemes, speaker, duration)
  styletts2/train_list.txt         # path|phonemes|speaker_id, plus val_list.txt and OOD_texts.txt
  pocket-tts/train.jsonl           # {"path","duration","transcript"}, plus valid.jsonl
  manifest.json                    # sample rate, counts, g2p versions, speaker id table
  ATTRIBUTION.md                   # license and credit for every text source used
```

`hash` is the first 16 hex characters of the SHA-256 of the exported WAV. On Chromium the app writes straight into a folder you pick; other browsers get a ZIP.

Trainer notes: StyleTTS2 crops training audio to 5 s by default and rejects phoneme strings over 512 tokens, so pick the `StyleTTS2 (5-15 s)` preset in `Pengaturan` and rebuild scripts before recording for it. PocketTTS takes files up to 30 s; the default `PocketTTS (10-30 s)` preset targets it. PocketTTS has no Indonesian model yet, so training it is the new-language path, which its authors size at 100 hours or more.

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

`corpus/raw/` is not committed. The current pool holds 35,753 entries, 991 coverage units, and about 55 hours of reading text; `public/corpus/ATTRIBUTION.md` lists what each source requires of a derived dataset.

## Repository map

```
audionesia-dataset-gen/
├── src/
│   ├── app.tsx  main.tsx        # shell: header, speaker picker, tabs, help dialogs
│   ├── components/              # Kumo-styled Solid components, one per file
│   ├── features/                # record, review, write, dataset, settings, speakers, library
│   ├── lib/                     # audio, corpus, db, export, g2p: pure logic and repositories
│   └── workers/                 # G2P worker, script-builder worker, recorder worklet
├── public/corpus/               # generated pool (committed)
├── scripts/corpus/              # fetch and build scripts
├── scripts/smoke.ts             # browser smoke test
├── tests/                       # bun test, mirrors src/lib
├── docs/                        # coding standard, review checklist
└── .claude/skills/              # solidjs-2 and kumo-design skills for agents
```

Stack: SolidJS 2.0 (release candidate, pinned), Vite 8, Tailwind CSS 4 with Cloudflare Kumo tokens, `idb`, `zod`, `fflate`, `indo-g2p`; Bun, oxlint, oxfmt, lefthook.

## Documentation

- [`CLAUDE.md`](./CLAUDE.md): the operating manual, invariants, and every command.
- [`docs/CODING_STANDARD.md`](./docs/CODING_STANDARD.md) and [`docs/CODE_REVIEW_CHECKLIST.md`](./docs/CODE_REVIEW_CHECKLIST.md).
- [`.claude/skills/solidjs-2/`](./.claude/skills/solidjs-2/SKILL.md): Solid 2.0 API and migration reference.

## Deploy

`.github/workflows/pages.yml` builds and publishes `dist/` on every push to `main`. Enable it once under Settings > Pages > Source: GitHub Actions.

## License

MIT. Text sources keep their own licenses: Common Voice sentences are CC0, Tatoeba sentences are CC BY 2.0 FR, Wikipedia text is CC BY-SA 4.0, VOA Indonesia reporting is public domain. The export writes `ATTRIBUTION.md` next to the audio so a published dataset carries them.

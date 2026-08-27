// Renders assets/banner.png (1280x640) from real pool data: how fast the greedy
// script builder covers the pool's diphones as scripts are read.
// Usage: bun run banner   (needs Google Chrome; Playwright drives it headless)
import { chromium } from "playwright";

import type { BuilderEntry } from "../src/lib/corpus/script-builder.ts";
import { buildScripts } from "../src/lib/corpus/script-builder.ts";
import { poolIndexSchema, poolSentenceSchema } from "../src/lib/corpus/schema.ts";
import { DEFAULT_SYLLABLES_PER_SECOND } from "../src/lib/duration.ts";
import { TRAINER_PRESETS } from "../src/lib/settings.ts";

const WIDTH = 1280;
const HEIGHT = 640;
const SCRIPTS_SHOWN = 600;
const LABELLED_AT = [50, 200, 600];
const OUT_HTML = "assets/banner.html";
const OUT_PNG = "assets/banner.png";

type Point = { scripts: number; coverage: number };

async function coverageCurve(): Promise<{ points: Point[]; diphones: number; hours: number }> {
  const index = poolIndexSchema.parse(await Bun.file("public/corpus/index.json").json());
  const entries: BuilderEntry[] = [];
  const unitsById = new Map<string, readonly number[]>();
  for (const line of (await Bun.file("public/corpus/pool.jsonl").text()).split("\n")) {
    if (line.trim() === "") continue;
    const row = poolSentenceSchema.parse(JSON.parse(line));
    entries.push({ id: row.id, syllables: row.syllables, units: row.units, source: row.source });
    unitsById.set(row.id, row.units);
  }
  const isDiphone = index.units.map((label) => label.startsWith("d:"));
  const diphones = isDiphone.filter(Boolean).length;
  const preset = TRAINER_PRESETS["pocket-tts"];
  const result = buildScripts(entries, {
    unitCount: index.units.length,
    minSyllables: Math.round(preset.minSec * DEFAULT_SYLLABLES_PER_SECOND),
    maxSyllables: Math.round(preset.maxSec * DEFAULT_SYLLABLES_PER_SECOND),
    scriptCount: SCRIPTS_SHOWN,
  });
  const covered = new Set<number>();
  const points: Point[] = [{ scripts: 0, coverage: 0 }];
  let syllables = 0;
  result.scripts.forEach((script, i) => {
    for (const id of script.sentenceIds) {
      for (const unit of unitsById.get(id) ?? []) if (isDiphone[unit] === true) covered.add(unit);
    }
    syllables += script.syllables;
    points.push({ scripts: i + 1, coverage: covered.size / diphones });
  });
  return { points, diphones, hours: syllables / DEFAULT_SYLLABLES_PER_SECOND / 3600 };
}

function chartSvg(points: Point[], diphones: number): string {
  const x0 = 60;
  const y0 = 56;
  const plotWidth = 540;
  const plotHeight = 224;
  const sx = (scripts: number): number => x0 + (scripts / SCRIPTS_SHOWN) * plotWidth;
  const sy = (coverage: number): number => y0 + (1 - coverage) * plotHeight;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.scripts).toFixed(1)},${sy(p.coverage).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${sx(SCRIPTS_SHOWN).toFixed(1)},${sy(0)} L${sx(0)},${sy(0)} Z`;
  const grid = [0.25, 0.5, 0.75, 1]
    .map(
      (v) =>
        `<line x1="${x0}" x2="${x0 + plotWidth}" y1="${sy(v)}" y2="${sy(v)}" class="grid"/>` +
        `<text x="${x0 - 10}" y="${sy(v) + 4}" class="tick" text-anchor="end">${Math.round(v * 100)}%</text>`
    )
    .join("");
  const xTicks = [0, 200, 400, 600]
    .map(
      (v) =>
        `<text x="${sx(v)}" y="${y0 + plotHeight + 22}" class="tick" text-anchor="middle">${v}</text>`
    )
    .join("");
  const marks = LABELLED_AT.map((n) => {
    const point = points[n];
    if (point === undefined) return "";
    const label = `${Math.round(point.coverage * 100)}%`;
    const anchor = n === SCRIPTS_SHOWN ? "end" : "start";
    const dx = n === SCRIPTS_SHOWN ? -12 : 12;
    return (
      `<circle cx="${sx(n)}" cy="${sy(point.coverage)}" r="6" class="mark"/>` +
      `<text x="${sx(n) + dx}" y="${sy(point.coverage) - 10}" class="label" text-anchor="${anchor}">${label} · ${n} naskah</text>`
    );
  }).join("");
  return `<svg viewBox="0 0 660 340" width="660" height="340" role="img" aria-label="Cakupan difon terhadap jumlah naskah yang dibaca">
    <path d="${area}" class="area"/>
    ${grid}
    <line x1="${x0}" x2="${x0 + plotWidth}" y1="${sy(0)}" y2="${sy(0)}" class="axis"/>
    <path d="${path}" class="line"/>
    ${marks}${xTicks}
    <text x="${x0 + plotWidth / 2}" y="${y0 + plotHeight + 44}" class="tick" text-anchor="middle">naskah dibaca (10–30 s per naskah)</text>
    <text x="${x0}" y="14" class="tick">cakupan ${diphones} difon dalam kumpulan</text>
  </svg>`;
}

function page(points: Point[], diphones: number, hours: number, total: number): string {
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Audionesia banner</title>
<style>
  :root { --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --ink-3: #8a8985; --series: #2a78d6; --series-fill: #cde2fb; --grid: #e6e5e1; }
  html, body { margin: 0; background: var(--surface); }
  body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; font-family: -apple-system, "Segoe UI", Inter, Helvetica, Arial, sans-serif; color: var(--ink); }
  .wrap { display: grid; grid-template-columns: 520px 1fr; gap: 40px; padding: 64px 60px 0 64px; height: 100%; box-sizing: border-box; }
  h1 { font-size: 64px; font-weight: 600; letter-spacing: 0; margin: 0 0 12px; line-height: 1; }
  .tag { font-size: 22px; line-height: 1.35; color: var(--ink-2); margin: 0 0 28px; }
  .sample { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 17px; line-height: 1.7; color: var(--ink-2); }
  .sample b { color: var(--ink); font-weight: 600; }
  .stats { margin-top: 30px; display: flex; gap: 32px; }
  .stat { display: flex; flex-direction: column; }
  .stat .n { font-size: 30px; font-weight: 600; }
  .stat .l { font-size: 14px; color: var(--ink-3); }
  .chart { align-self: end; padding-bottom: 28px; }
  .area { fill: var(--series-fill); opacity: 0.45; }
  .line { fill: none; stroke: var(--series); stroke-width: 2; stroke-linejoin: round; }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .axis { stroke: var(--ink-3); stroke-width: 1; }
  .mark { fill: var(--series); stroke: var(--surface); stroke-width: 2; }
  .tick { font-size: 13px; fill: var(--ink-3); }
  .label { font-size: 15px; font-weight: 600; fill: var(--ink); }
</style></head>
<body><div class="wrap">
  <div>
    <h1>Audionesia</h1>
    <p class="tag">Pembuat dataset suara untuk TTS bahasa Indonesia. Naskah seimbang fonem, rekam di peramban, ekspor untuk StyleTTS2 dan PocketTTS.</p>
    <div class="sample">Tak seorang pun boleh ditangkap.<br><b>taʔ səoraŋ pun boleh ditaŋkap.</b></div>
    <div class="stats">
      <div class="stat"><span class="n">${total.toLocaleString("id-ID")}</span><span class="l">kalimat berfonem</span></div>
      <div class="stat"><span class="n">${diphones}</span><span class="l">difon terlacak</span></div>
      <div class="stat"><span class="n">${hours.toFixed(1)} j</span><span class="l">teks dalam ${SCRIPTS_SHOWN} naskah</span></div>
    </div>
  </div>
  <div class="chart">${chartSvg(points, diphones)}</div>
</div></body></html>
`;
}

const curve = await coverageCurve();
const total = poolIndexSchema.parse(await Bun.file("public/corpus/index.json").json()).count;
await Bun.write(OUT_HTML, page(curve.points, curve.diphones, curve.hours, total));
for (const n of LABELLED_AT) {
  const point = curve.points[n];
  console.log(
    `${n} scripts: ${((point?.coverage ?? 0) * 100).toFixed(1)}% of ${curve.diphones} diphones`
  );
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const browserPage = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});
await browserPage.goto(`file://${process.cwd()}/${OUT_HTML}`);
await browserPage.waitForTimeout(300);
await browserPage.screenshot({ path: OUT_PNG, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
await browser.close();
console.log(`wrote ${OUT_PNG}`);

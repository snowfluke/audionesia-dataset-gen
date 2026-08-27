// Browser smoke test against the dev server: seeds the corpus, creates a
// dataset workspace, records with Chrome's fake microphone, reviews with
// play/pause, searches the clip list, exports a ZIP, backs up, and reloads.
// Usage: bun run dev (in another terminal), then bun run smoke. Needs Google Chrome.
// Screenshots and the ZIPs land in .smoke/.
import { chromium } from "playwright";

const APP_URL = "http://localhost:5173/";
const OUT = ".smoke/";
const errors: string[] = [];

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const context = await browser.newContext({ permissions: ["microphone"], acceptDownloads: true });
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    errors.push(`[console.${message.type()}] ${message.text()}`);
  }
});
page.on("pageerror", (error) => errors.push(`[pageerror] ${error.message}`));

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });
  console.log(`screenshot ${name}`);
}

await Bun.write(`${OUT}.keep`, "");
console.log("nav");
await page.goto(APP_URL);
await page.getByText("Audionesia Dataset Generator").first().waitFor({ timeout: 30_000 });
await shot("01-home");

console.log("waiting for seeding + script build");
await page.waitForFunction(
  `!document.body.innerText.includes("Memuat") && !document.body.innerText.includes("Menyusun")`,
  undefined,
  { timeout: 240_000 }
);
await shot("02-ready");

console.log("create workspace");
await page.getByRole("button", { name: "+ Dataset baru" }).click();
await page.getByPlaceholder("Suara Budi").fill("Suara Budi");
await page.getByPlaceholder("Budi Santoso").fill("Budi");
await page.locator("dialog[open] input[type=checkbox]").check();
await page.locator("dialog[open] button[type=submit]").click();
await page.getByRole("navigation", { name: "Lokasi" }).waitFor({ timeout: 10_000 });
await page.locator("p.text-2xl").first().waitFor({ timeout: 60_000 });
const scriptText = await page.locator("p.text-2xl").first().innerText();
console.log("script:", scriptText.slice(0, 120));
await shot("03-script");

console.log("allow clipped takes (the fake microphone is full scale)");
await page.getByRole("tab", { name: "Pengaturan" }).click();
await page.getByRole("switch", { name: /terpotong/ }).click();
await page.getByRole("tab", { name: "Rekam" }).click();
await page.locator("p.text-2xl").first().waitFor({ timeout: 60_000 });

console.log("record");
await page.getByRole("button", { name: "Nyalakan mikrofon" }).click();
await page.getByRole("button", { name: "Rekam", exact: true }).waitFor({ timeout: 15_000 });
await page.getByRole("button", { name: "Rekam", exact: true }).click();
await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Berhenti" }).click();
await page.getByText("Durasi").waitFor({ timeout: 10_000 });
await shot("04-take");
console.log("play / pause the take");
await page.getByRole("button", { name: "Putar", exact: true }).click();
await page.getByRole("button", { name: "Jeda", exact: true }).waitFor({ timeout: 5_000 });
await page.getByRole("button", { name: "Jeda", exact: true }).click();
await page.getByRole("button", { name: "Putar", exact: true }).waitFor({ timeout: 5_000 });
await page.getByRole("button", { name: "Simpan", exact: true }).click();
await page.getByText("Klip tersimpan").waitFor({ timeout: 10_000 });
await shot("05-saved");

console.log("review: play, pause, resume, approve");
await page.getByRole("tab", { name: "Dengarkan" }).click();
const card = page.locator("section", {
  has: page.getByRole("button", { name: "Ya", exact: true }),
});
await card.getByRole("button", { name: "Putar", exact: true }).waitFor({ timeout: 15_000 });
await card.getByRole("button", { name: "Putar", exact: true }).click();
await card.getByRole("button", { name: "Jeda", exact: true }).waitFor({ timeout: 5_000 });
await card.getByRole("button", { name: "Jeda", exact: true }).click();
await card.getByRole("button", { name: "Putar", exact: true }).waitFor({ timeout: 5_000 });
await card.getByRole("button", { name: "Putar", exact: true }).click();
await card.getByRole("button", { name: "Jeda", exact: true }).waitFor({ timeout: 5_000 });
await shot("06-playing");
await page.getByRole("button", { name: "Ya", exact: true }).click();
await page.getByText("Klip disetujui").waitFor({ timeout: 10_000 });

console.log("clip list: filter, search, pagination");
await page.getByRole("tab", { name: "Disetujui" }).click();
await page.getByRole("cell", { name: "clip_0001.wav" }).waitFor({ timeout: 15_000 });
await page.getByRole("button", { name: "Rekam ulang naskah" }).waitFor({ timeout: 15_000 });
await page.getByLabel("Cari klip").fill("tidak-ada-teks-ini");
await page.getByText("Tidak ada klip yang cocok").waitFor({ timeout: 5_000 });
await page.getByLabel("Cari klip").fill("clip_0001");
await page.getByRole("cell", { name: "clip_0001.wav" }).waitFor({ timeout: 5_000 });
await page.getByText("Halaman 1 dari 1").waitFor({ timeout: 5_000 });
await page.getByLabel("Cari klip").fill("");
await shot("07-clip-list");

console.log("dataset + export zip");
await page.getByRole("tab", { name: "Dataset" }).click();
await page.getByText("Ekspor dataset").waitFor({ timeout: 15_000 });
await page.getByLabel("Struktur folder ekspor").waitFor({ timeout: 15_000 });
const tree = await page.getByLabel("Struktur folder ekspor").innerText();
if (!tree.includes("speakers.jsonl") || !tree.includes("budi/")) {
  errors.push(`[smoke] export tree missing entries:\n${tree}`);
}
await shot("08-dataset");
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 60_000 }),
  page.getByRole("button", { name: "Unduh ZIP" }).click(),
]);
const zipPath = `${OUT}dataset.zip`;
await download.saveAs(zipPath);
console.log("zip saved:", zipPath);
await page.getByText("klip diekspor").waitFor({ timeout: 15_000 });
await shot("09-exported");

console.log("own text tab + sample file");
await page.getByRole("tab", { name: "Teks sendiri" }).click();
await page.getByRole("link", { name: "contoh-kalimat.txt" }).waitFor({ timeout: 10_000 });
await shot("10-write");

console.log("home + backup zip");
await page.getByRole("button", { name: "← Semua dataset" }).click();
await page.getByRole("button", { name: "Buka" }).waitFor({ timeout: 15_000 });
const [backup] = await Promise.all([
  page.waitForEvent("download", { timeout: 60_000 }),
  page.getByRole("button", { name: "Cadangkan sebagai ZIP" }).click(),
]);
await backup.saveAs(`${OUT}backup.zip`);
await page.getByText("klip dicadangkan").waitFor({ timeout: 15_000 });
await shot("11-home-with-dataset");

console.log("reopen + reload persistence");
await page.getByRole("button", { name: "Buka" }).click();
await page.getByRole("navigation", { name: "Lokasi" }).waitFor({ timeout: 10_000 });
await page.reload();
await page.getByRole("navigation", { name: "Lokasi" }).waitFor({ timeout: 60_000 });
await page.getByRole("tab", { name: "Dengarkan" }).click();
await page.getByRole("tab", { name: "Disetujui" }).click();
await page.getByRole("cell", { name: "clip_0001.wav" }).waitFor({ timeout: 15_000 });
await shot("12-after-reload");

await browser.close();
console.log(`console errors/warnings: ${errors.length}`);
for (const line of errors) console.log(`  ${line.slice(0, 300)}`);

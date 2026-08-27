// Browser smoke test against the dev server: seeds the corpus, creates a speaker,
// records with Chrome's fake microphone, reviews, exports a ZIP, and reloads.
// Usage: bun run dev (in another terminal), then bun run smoke. Needs Google Chrome.
// Screenshots and the ZIP land in .smoke/.
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
await page.getByText("Audionesia").first().waitFor({ timeout: 30_000 });
await shot("01-loaded");

console.log("waiting for seeding + script build");
await page.waitForFunction(
  `!document.body.innerText.includes("Memuat") && !document.body.innerText.includes("Menyusun")`,
  undefined,
  { timeout: 240_000 }
);
await shot("02-ready");

console.log("create speaker");
await page.getByRole("button", { name: "+ Pembicara baru" }).click();
await page.getByPlaceholder("Budi Santoso").fill("Budi");
await page.locator("dialog[open] button[type=submit]").click();
await page.locator("select[aria-label=Pembicara]").waitFor({ timeout: 10_000 });
await page.locator("p.text-2xl").first().waitFor({ timeout: 60_000 });
const scriptText = await page.locator("p.text-2xl").first().innerText();
console.log("script:", scriptText.slice(0, 120));
await shot("03-script");

console.log("record");
await page.getByRole("button", { name: "Nyalakan mikrofon" }).click();
await page.getByRole("button", { name: "Rekam", exact: true }).waitFor({ timeout: 15_000 });
await page.getByRole("button", { name: "Rekam", exact: true }).click();
await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Berhenti" }).click();
await page.getByText("Durasi").waitFor({ timeout: 10_000 });
await shot("04-take");
await page.getByRole("button", { name: "Simpan", exact: true }).click();
await page.getByText("Klip tersimpan").waitFor({ timeout: 10_000 });
await shot("05-saved");

console.log("review");
await page.getByRole("tab", { name: "Dengarkan" }).click();
await page.getByRole("button", { name: "Putar" }).waitFor({ timeout: 15_000 });
await page.getByRole("button", { name: "Putar" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Ya", exact: true }).click();
await page.getByText("Klip disetujui").waitFor({ timeout: 10_000 });
await shot("06-reviewed");

console.log("dataset + export zip");
await page.getByRole("tab", { name: "Dataset" }).click();
await page.getByText("Ekspor dataset").waitFor({ timeout: 15_000 });
await page.getByRole("cell", { name: "Budi" }).waitFor({ timeout: 15_000 });
await shot("07-dataset");
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 60_000 }),
  page.getByRole("button", { name: "Unduh ZIP" }).click(),
]);
const zipPath = `${OUT}dataset.zip`;
await download.saveAs(zipPath);
console.log("zip saved:", zipPath);
await page.getByText("klip diekspor").waitFor({ timeout: 15_000 });
await shot("08-exported");

console.log("settings tab");
await page.getByRole("tab", { name: "Pengaturan" }).click();
await page.getByText("Jendela durasi").waitFor({ timeout: 10_000 });
await shot("09-settings");

console.log("reload persistence");
await page.reload();
await page.locator("select[aria-label=Pembicara]").waitFor({ timeout: 60_000 });
await page.getByRole("tab", { name: "Dataset" }).click();
await page.getByRole("cell", { name: "Budi" }).waitFor({ timeout: 15_000 });
await shot("10-after-reload");

await browser.close();
console.log(`console errors/warnings: ${errors.length}`);
for (const line of errors) console.log(`  ${line.slice(0, 300)}`);

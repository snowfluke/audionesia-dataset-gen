/** Sentences a first-time user can download and import to see the Teks sendiri flow work. */
export const SAMPLE_SENTENCES: readonly string[] = [
  "Pagi ini ibu memasak nasi goreng dengan telur mata sapi untuk sarapan keluarga.",
  "Kereta api menuju Yogyakarta berangkat pukul tujuh dan tiba menjelang sore.",
  "Anak-anak bermain layang-layang di lapangan sambil menunggu hujan reda.",
  "Harga cabai di pasar tradisional naik dua kali lipat sejak awal bulan.",
  "Apakah kamu sudah membaca buku yang kupinjamkan minggu lalu?",
  "Tolong matikan lampu dan kunci pintu sebelum kamu pergi!",
  "Nelayan di pesisir Sulawesi mengeluh karena cuaca buruk menghalangi mereka melaut.",
  "Menurut dokter, tidur cukup dan olahraga ringan membantu menjaga daya tahan tubuh.",
  "Presiden meresmikan bendungan baru yang mengairi sawah seluas dua ribu hektare.",
  "Kucing peliharaan tetangga sering tidur di atas atap mobil kami pada siang hari.",
];

export type SampleFile = { name: string; mimeType: string; content: string };

/** One sample per accepted import format, in the shape `textsFromFile` reads. */
export const SAMPLE_FILES: readonly SampleFile[] = [
  {
    name: "contoh-kalimat.txt",
    mimeType: "text/plain",
    content: `${SAMPLE_SENTENCES.join("\n")}\n`,
  },
  {
    name: "contoh-kalimat.tsv",
    mimeType: "text/tab-separated-values",
    content: `sentence\n${SAMPLE_SENTENCES.join("\n")}\n`,
  },
  {
    name: "contoh-kalimat.jsonl",
    mimeType: "application/x-ndjson",
    content: `${SAMPLE_SENTENCES.map((text) => JSON.stringify({ text })).join("\n")}\n`,
  },
];

export function sampleDataUrl(file: SampleFile): string {
  return `data:${file.mimeType};charset=utf-8,${encodeURIComponent(file.content)}`;
}

import type { JSX } from "@solidjs/web";

import Dialog from "./components/dialog.tsx";
import Kbd from "./components/kbd.tsx";

export type HelpTopic = "none" | "guide" | "shortcuts";

export type HelpDialogsProps = { topic: HelpTopic; onClose: () => void };

/** The recording guide and the shortcut sheet behind the footer buttons. */
export default function HelpDialogs(props: HelpDialogsProps): JSX.Element {
  return (
    <>
      <Dialog
        open={props.topic === "guide"}
        onClose={() => props.onClose()}
        title="Panduan merekam"
        size="lg"
      >
        <ol class="flex list-decimal flex-col gap-2 pl-5 text-base">
          <li>Buat satu dataset per pembicara, lalu buka dataset itu untuk mulai merekam.</li>
          <li>
            Gunakan mikrofon yang sama dan ruangan yang sunyi untuk semua klip satu pembicara.
          </li>
          <li>
            Baca naskah dengan tempo wajar. Jeda pendek di koma dan titik membantu model belajar
            prosodi.
          </li>
          <li>
            Jaga puncak di bawah -3 dBFS. Klip yang terpotong (clipping) ditandai merah; rekam
            ulang.
          </li>
          <li>Setujui klip di tab Dengarkan hanya jika setiap kata terucap sesuai naskah.</li>
          <li>
            Teks sendiri yang ditambahkan menjadi naskah pertama di antrean Rekam. Tab Klip
            menampilkan semua rekaman dataset.
          </li>
          <li>
            Ekspor secara berkala dari tab Dataset dan cadangkan dari halaman depan. Peramban bisa
            menghapus penyimpanan lokal.
          </li>
        </ol>
      </Dialog>
      <Dialog
        open={props.topic === "shortcuts"}
        onClose={() => props.onClose()}
        title="Pintasan keyboard"
      >
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
          <dt>
            <Kbd>Spasi</Kbd>
          </dt>
          <dd>Rekam / berhenti (Rekam), putar (Dengarkan)</dd>
          <dt>
            <Kbd>Enter</Kbd>
          </dt>
          <dd>Simpan klip</dd>
          <dt>
            <Kbd>R</Kbd>
          </dt>
          <dd>Rekam ulang</dd>
          <dt>
            <Kbd>P</Kbd>
          </dt>
          <dd>Putar rekaman terakhir</dd>
          <dt>
            <Kbd>S</Kbd>
          </dt>
          <dd>Lewati naskah</dd>
          <dt>
            <Kbd>Y</Kbd> / <Kbd>N</Kbd>
          </dt>
          <dd>Setujui / tolak klip</dd>
        </dl>
      </Dialog>
    </>
  );
}

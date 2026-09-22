import { describe, expect, it } from "bun:test";

import { dedupKey, normalizeSentence, rejectReason } from "../../src/lib/corpus/filter.ts";

describe("normalizeSentence", () => {
  it("folds typographic punctuation and collapses whitespace", () => {
    expect(normalizeSentence("“Halo”   —  dunia…  ‘ya’ ")).toBe(`"Halo" - dunia... 'ya'`);
  });

  it("turns non-breaking spaces and newlines into single spaces", () => {
    expect(normalizeSentence("Satu dua\n\ntiga")).toBe("Satu dua tiga");
  });
});

describe("rejectReason", () => {
  it("accepts ordinary Indonesian prose", () => {
    expect(rejectReason("Saya pergi ke pasar pagi ini.")).toBeNull();
    expect(rejectReason("Harga Rp15.000 naik 5% tahun ini.")).toBeNull();
  });

  it("rejects by length and by word count", () => {
    expect(rejectReason("Halo.")).toBe("too-short");
    expect(rejectReason("Saya ".repeat(100))).toBe("too-long");
    expect(rejectReason("Selamat pagi semua.")).toBe("too-few-words");
    expect(rejectReason("Selamat pagi semua orang.")).toBeNull();
  });

  it("rejects text indo-g2p cannot read", () => {
    expect(rejectReason("Café di Jakarta buka lagi.")).toBe("non-ascii");
    expect(rejectReason("Lihat catatan kaki [1] ini.")).toBe("markup");
    expect(rejectReason("Kunjungi www.contoh.id sekarang.")).toBe("url");
    expect(rejectReason("Baca di https://a.b/c dulu.")).toBe("url");
  });

  it("rejects digit-heavy, capital-heavy, and letterless lines", () => {
    expect(rejectReason("1234567890 12")).toBe("no-letters");
    expect(rejectReason("Nomor 08123456789 aktif.")).toBe("too-many-digits");
    expect(rejectReason("PT KAI DAN KRL JABODETABEK")).toBe("too-many-capitals");
  });

  it("rejects foreign clauses hidden in Indonesian frames", () => {
    expect(
      rejectReason(
        "Schneider menulis sejumlah drama, seperti Tweelicht, Rinkelrooien, De stilte aan de andere kant van de weg."
      )
    ).toBe("foreign-words");
    expect(
      rejectReason("Turnbull menegaskan jika Dutton berhasil mendapatkan mayoritas untuk mengajukan mosi pemilihan.")
    ).toBeNull();
  });

  it("rejects words no Indonesian mouth spells", () => {
    expect(
      rejectReason("Schneider menulis drama Tweelicht dan Rinkelrooien setiap malam minggu.")
    ).toBe("foreign-spelling");
    expect(rejectReason("Bacaan Alquran itu merdu sekali didengar setiap pagi hari.")).toBeNull();
    expect(rejectReason("Umat muslim menunaikan sholat lima waktu setiap hari.")).toBeNull();
  });

  it("rejects name lists paired with any other foreign signal", () => {
    expect(
      rejectReason(
        "Hub global maskapai ini berada di Bandara Charles de Gaulle dengan Bandara Orly sebagai hub utama."
      )
    ).toBe("foreign-names");
    expect(rejectReason("Kereta api menuju Yogyakarta berangkat pukul tujuh dan tiba menjelang sore.")).toBeNull();
  });

  it("rejects parenthetical asides and template residue", () => {
    expect(
      rejectReason("Kim Possible (saingan Ron Stoppable di Camp Wannaweep) tampil lagi.")
    ).toBe("parenthetical");
    expect(
      rejectReason("Flying while Muslimcode: en is deprecated adalah deskripsi sinis penumpang.")
    ).toBe("markup");
  });

  it("rejects Latin species lists no reader pronounces", () => {
    expect(
      rejectReason("Estola brunneovariegata adalah spesies kumbang yang tergolong famili Cerambycidae.")
    ).toBe("latin-taxonomy");
    expect(rejectReason("Harimau sumatra Panthera tigris sumatrae dilindungi undang-undang.")).toBe(
      "latin-taxonomy"
    );
    expect(rejectReason("Anak-anak kecil suka dengan buku tentang dinosaurus dan monster.")).toBeNull();
    expect(rejectReason("Homo erectus muncul sekitar 2 juta tahun yang lalu di Afrika.")).toBeNull();
  });

  it("rejects formulas and catalogue numbers, keeps agreed readings", () => {
    expect(
      rejectReason("Senyawa ini juga disebut asam aurat dengan rumus kimia H3AuO3.")
    ).toBe("chemical-notation");
    expect(
      rejectReason("Radioisotop amerisium 223Am dan 229Am telah dikarakterisasi tahun ini.")
    ).toBe("chemical-notation");
    expect(rejectReason("Penumpang flu burung H5N1 dirawat di rumah sakit rujukan.")).toBeNull();
    expect(rejectReason("Harga Rp15.000 naik 5% tahun ini.")).toBeNull();
    expect(rejectReason("Saya menyimpan file lagu dalam format mp3 di komputer.")).toBeNull();
  });
});

describe("dedupKey", () => {
  it("ignores case, punctuation, and spacing", () => {
    expect(dedupKey("Halo, Dunia!")).toBe(dedupKey("halo dunia"));
    expect(dedupKey("Halo dunia")).not.toBe(dedupKey("Halo dunia kita"));
  });
});

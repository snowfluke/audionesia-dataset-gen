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

  it("rejects by length", () => {
    expect(rejectReason("Halo.")).toBe("too-short");
    expect(rejectReason("Saya ".repeat(100))).toBe("too-long");
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
});

describe("dedupKey", () => {
  it("ignores case, punctuation, and spacing", () => {
    expect(dedupKey("Halo, Dunia!")).toBe(dedupKey("halo dunia"));
    expect(dedupKey("Halo dunia")).not.toBe(dedupKey("Halo dunia kita"));
  });
});

import { describe, expect, it } from "bun:test";

import { slugify } from "../src/lib/slug.ts";

describe("slugify", () => {
  it("lowercases and joins words with single underscores", () => {
    expect(slugify("Budi Santoso")).toBe("budi_santoso");
    expect(slugify("  Dewi   Ayu  ")).toBe("dewi_ayu");
  });

  it("strips diacritics and symbols", () => {
    expect(slugify("Émile Zoë!")).toBe("emile_zoe");
    expect(slugify("Rp 15.000 (test)")).toBe("rp_15_000_test");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("¡¿—")).toBe("");
    expect(slugify("")).toBe("");
  });
});

import { describe, expect, it } from "bun:test";

import { sha256Hex, shortHash, textId } from "../src/lib/hash.ts";

const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("hash helpers", () => {
  it("computes SHA-256 as lowercase hex", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(ABC_SHA256);
  });

  it("shortens to the dataset hash length", async () => {
    expect(await shortHash(new TextEncoder().encode("abc"))).toBe(ABC_SHA256.slice(0, 16));
  });

  it("derives a stable text id", async () => {
    expect(await textId("abc")).toBe(ABC_SHA256.slice(0, 12));
    expect(await textId("abc", 6)).toBe(ABC_SHA256.slice(0, 6));
  });
});

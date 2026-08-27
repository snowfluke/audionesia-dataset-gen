export const SHORT_HASH_LENGTH = 16;

/** Lowercase hex SHA-256 of the bytes. */
export async function sha256Hex(bytes: Uint8Array<ArrayBuffer> | ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  let hex = "";
  for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

/** The dataset `hash` field: the first 16 hex characters of SHA-256. */
export async function shortHash(bytes: Uint8Array<ArrayBuffer> | ArrayBuffer): Promise<string> {
  return (await sha256Hex(bytes)).slice(0, SHORT_HASH_LENGTH);
}

/** Stable id for a text, from its SHA-256. */
export async function textId(text: string, length = 12): Promise<string> {
  return (await sha256Hex(new TextEncoder().encode(text))).slice(0, length);
}

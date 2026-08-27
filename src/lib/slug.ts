/**
 * Folder-safe speaker id: ASCII letters, digits and single underscores.
 * `"Budi Santoso"` becomes `"budi_santoso"`; an empty result means the name is unusable.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

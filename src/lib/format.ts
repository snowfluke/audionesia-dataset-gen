const ID_LOCALE = "id-ID";

/** `12,3 s` in the id-ID locale. */
export function formatSeconds(seconds: number): string {
  return `${seconds.toLocaleString(ID_LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`;
}

/** `1 j 23 mnt` or `4 mnt` or `35 s`. */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} j ${minutes} mnt`;
  if (minutes > 0) return `${minutes} mnt`;
  return `${Math.round(totalSeconds)} s`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3)
    return `${(bytes / 1024 ** 3).toLocaleString(ID_LOCALE, { maximumFractionDigits: 2 })} GB`;
  if (bytes >= 1024 ** 2)
    return `${(bytes / 1024 ** 2).toLocaleString(ID_LOCALE, { maximumFractionDigits: 1 })} MB`;
  return `${Math.round(bytes / 1024).toLocaleString(ID_LOCALE)} KB`;
}

export function formatCount(value: number): string {
  return value.toLocaleString(ID_LOCALE);
}

export const RAW_DIR = "corpus/raw";
export const PUBLIC_DIR = "public/corpus";

export async function download(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

export async function writeJsonl<T>(path: string, rows: readonly T[]): Promise<void> {
  await Bun.write(path, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

import { createSignal } from "solid-js";

export type Progress = { label: string; done: number; total: number };

export type ProgressRunner = {
  progress: () => Progress | null;
  setProgress: (progress: Progress | null) => void;
  /** Runs one long task at a time; a second call while busy is ignored. */
  run: (
    label: string,
    task: (report: (done: number, total: number) => void) => Promise<void>
  ) => Promise<void>;
};

export function createProgressRunner(): ProgressRunner {
  const [progress, setProgress] = createSignal<Progress | null>(null);
  async function run(
    label: string,
    task: (report: (done: number, total: number) => void) => Promise<void>
  ): Promise<void> {
    if (progress() !== null) return;
    setProgress({ label, done: 0, total: 0 });
    try {
      await task((done, total) => setProgress({ label, done, total }));
    } finally {
      setProgress(null);
    }
  }
  return { progress, setProgress, run };
}

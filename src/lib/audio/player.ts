import { createSignal } from "solid-js";

import type { Playback } from "./playback.ts";

export type PlayState = "idle" | "playing" | "paused";

/** Putar / Jeda state for one audio source at a time; call inside a store. */
export type Player = {
  state: () => PlayState;
  /** Starts `start()` when idle, pauses when playing, resumes when paused. */
  toggle: (start: () => Promise<Playback>) => Promise<void>;
  stop: () => void;
};

export function createPlayer(): Player {
  const [state, setState] = createSignal<PlayState>("idle");
  let playback: Playback | null = null;
  let starting = false;

  function stop(): void {
    playback?.stop();
    playback = null;
    setState("idle");
  }

  async function toggle(start: () => Promise<Playback>): Promise<void> {
    if (starting) return;
    if (playback !== null && state() === "playing") {
      playback.pause();
      setState("paused");
      return;
    }
    if (playback !== null && state() === "paused") {
      await playback.resume();
      setState("playing");
      return;
    }
    stop();
    starting = true;
    let own: Playback;
    try {
      own = await start();
    } finally {
      starting = false;
    }
    playback = own;
    setState("playing");
    void (async () => {
      await own.finished;
      // A newer playback may have replaced this one while it ran.
      if (playback === own) {
        playback = null;
        setState("idle");
      }
    })();
  }

  return { state, toggle, stop };
}

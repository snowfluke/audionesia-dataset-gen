import { VERSION, explain, toPhoneme } from "indo-g2p";

import { englishShare, unitLabels } from "../lib/corpus/coverage.ts";
import type { PhonemizeRequest, PhonemizeResponse, Phonemized } from "../lib/g2p/messages.ts";

function phonemizeOne(text: string): Phonemized {
  const result = toPhoneme(text);
  const traces = explain(text);
  return {
    text,
    phonemes: result.phonemes,
    syllables: result.syllables.filter((syllable) => syllable !== " ").length,
    labels: unitLabels(text, result.phonemes, traces),
    englishShare: englishShare(traces),
  };
}

self.onmessage = (event: MessageEvent<PhonemizeRequest>) => {
  const response: PhonemizeResponse = {
    g2pVersion: VERSION,
    results: event.data.texts.map(phonemizeOne),
  };
  self.postMessage(response);
};

/**
 * Resamples mono float samples with the browser's own converter.
 *
 * ponytail: OfflineAudioContext resampling is engine-specific, so the exported
 * bytes (and the dataset `hash`) match only within one browser engine. Swap in
 * a windowed-sinc resampler if cross-browser byte identity is ever needed.
 */
export async function resample(
  samples: Float32Array<ArrayBuffer>,
  fromRate: number,
  toRate: number
): Promise<Float32Array<ArrayBuffer>> {
  if (fromRate === toRate || samples.length === 0) return samples;
  const length = Math.ceil((samples.length * toRate) / fromRate);
  const context = new OfflineAudioContext(1, length, toRate);
  const buffer = context.createBuffer(1, samples.length, fromRate);
  buffer.copyToChannel(samples, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0);
  const rendered = await context.startRendering();
  return rendered.getChannelData(0);
}

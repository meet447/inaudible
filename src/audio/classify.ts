import { MIN_TONE_DB, SNR_RATIO } from "./constants";
import type { Bit } from "./protocol";

export function binForFrequency(frequency: number, sampleRate: number, fftSize: number): number {
  return Math.round((frequency * fftSize) / sampleRate);
}

export function bandEnergy(db: Float32Array, centerBin: number, neighbors: number): number {
  let powerSum = 0;
  let count = 0;
  for (let i = centerBin - neighbors; i <= centerBin + neighbors; i += 1) {
    if (i >= 0 && i < db.length) {
      const value = db[i];
      if (Number.isFinite(value)) {
        powerSum += 10 ** (value / 10);
        count += 1;
      }
    }
  }
  if (count === 0) return MIN_TONE_DB;
  return 10 * Math.log10(powerSum / count);
}

export function decideBit(energy0: number, energy1: number): Bit | null {
  const louder = Math.max(energy0, energy1);
  if (louder < MIN_TONE_DB) return null;
  const p0 = 10 ** (energy0 / 10);
  const p1 = 10 ** (energy1 / 10);
  const peak = Math.max(p0, p1);
  const other = Math.min(p0, p1);
  if (other <= 0 || peak / other < SNR_RATIO) return null;
  return p1 > p0 ? 1 : 0;
}

export function majorityBit(votes: readonly Bit[]): Bit | null {
  if (votes.length === 0) return null;
  let ones = 0;
  for (const vote of votes) ones += vote;
  return ones * 2 >= votes.length ? 1 : 0;
}

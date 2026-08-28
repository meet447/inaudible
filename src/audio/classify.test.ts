import { describe, expect, it } from "vitest";
import { MIN_TONE_DB } from "./constants";
import { bandEnergy, binForFrequency, decideBit, majorityBit } from "./classify";

describe("tone classification", () => {
  it("maps frequencies onto FFT bins", () => {
    expect(binForFrequency(18_500, 48_000, 2048)).toBe(Math.round((18_500 * 2048) / 48_000));
    expect(binForFrequency(17_500, 48_000, 2048)).not.toBe(binForFrequency(18_500, 48_000, 2048));
  });

  it("returns null when both carriers are too quiet", () => {
    expect(decideBit(-90, -88)).toBeNull();
  });

  it("picks the louder carrier when SNR is high enough", () => {
    expect(decideBit(-40, -55)).toBe(0);
    expect(decideBit(-55, -40)).toBe(1);
  });

  it("returns null when the two carriers are too close in energy", () => {
    expect(decideBit(-40, -39.5)).toBeNull();
  });

  it("majority-votes a symbol", () => {
    expect(majorityBit([1, 1, 0])).toBe(1);
    expect(majorityBit([0, 0, 1, 0])).toBe(0);
    expect(majorityBit([])).toBeNull();
  });

  it("bandEnergy ignores -Infinity neighbors and returns finite energy near the loud bin", () => {
    const db = new Float32Array([-Infinity, -Infinity, -40, -Infinity, -Infinity]);
    const energy = bandEnergy(db, 2, 2);
    expect(Number.isFinite(energy)).toBe(true);
    expect(energy).toBeGreaterThan(MIN_TONE_DB);
    expect(energy).toBeCloseTo(-40, 5);
  });

  it("bandEnergy returns MIN_TONE_DB when all bins in the window are -Infinity", () => {
    const db = new Float32Array([-Infinity, -Infinity, -Infinity, -Infinity, -Infinity]);
    expect(bandEnergy(db, 2, 2)).toBe(MIN_TONE_DB);
  });

  it("bandEnergy averages uniform finite bins in linear power", () => {
    const db = new Float32Array([-40, -40, -40]);
    expect(bandEnergy(db, 1, 1)).toBeCloseTo(-40, 5);
  });
});

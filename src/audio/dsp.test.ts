import { describe, expect, it } from "vitest";
import { BitSlicer } from "./clock";
import {
  AUDIBLE_FREQ_0,
  AUDIBLE_FREQ_1,
  GOERTZEL_WINDOW_SAMPLES,
  TARGET_SAMPLE_RATE,
  ULTRASONIC_FREQ_0,
  ULTRASONIC_FREQ_1,
} from "./constants";
import { classifyWindow, scanDecisions, synthesizeFsk } from "./dsp";
import { decodeFramedBits, encodeMessage } from "./protocol";

const IRREGULAR_HOPS = [800, 750, 850, 700, 900, 825, 775, 875, 725, 925] as const;

function windowSlice(audio: Float32Array, start: number): Float32Array {
  return audio.subarray(start, start + GOERTZEL_WINDOW_SAMPLES);
}

describe("PCM FSK loopback", () => {
  it("classifies a pure ultrasonic mark and space", () => {
    const space = synthesizeFsk([0], ULTRASONIC_FREQ_0, ULTRASONIC_FREQ_1);
    const mark = synthesizeFsk([1], ULTRASONIC_FREQ_0, ULTRASONIC_FREQ_1);
    expect(classifyWindow(space, ULTRASONIC_FREQ_0, ULTRASONIC_FREQ_1)).toBe(0);
    expect(classifyWindow(mark, ULTRASONIC_FREQ_0, ULTRASONIC_FREQ_1)).toBe(1);
  });

  it("decodes a synthesized inaudible frame", () => {
    const framed = encodeMessage("hello fsk");
    const audio = synthesizeFsk(framed, ULTRASONIC_FREQ_0, ULTRASONIC_FREQ_1);
    const slicer = new BitSlicer();
    for (const sample of scanDecisions(audio, ULTRASONIC_FREQ_0, ULTRASONIC_FREQ_1)) {
      slicer.push(sample.now, sample.decision);
    }
    slicer.push((audio.length / 48_000) * 1000 + 400, null);
    const decoded = decodeFramedBits(slicer.bits);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.text).toBe("hello fsk");
    }
  });

  it("classifies a 2048-sample ultrasonic window from synthesized FSK", () => {
    const space = synthesizeFsk([0], ULTRASONIC_FREQ_0, ULTRASONIC_FREQ_1, TARGET_SAMPLE_RATE);
    const mark = synthesizeFsk([1], ULTRASONIC_FREQ_0, ULTRASONIC_FREQ_1, TARGET_SAMPLE_RATE);
    const offset = Math.floor(space.length / 2) - GOERTZEL_WINDOW_SAMPLES / 2;
    expect(
      classifyWindow(
        windowSlice(space, offset),
        ULTRASONIC_FREQ_0,
        ULTRASONIC_FREQ_1,
        TARGET_SAMPLE_RATE,
      ),
    ).toBe(0);
    expect(
      classifyWindow(
        windowSlice(mark, offset),
        ULTRASONIC_FREQ_0,
        ULTRASONIC_FREQ_1,
        TARGET_SAMPLE_RATE,
      ),
    ).toBe(1);
  });

  it("classifies a 2048-sample audible window from synthesized FSK", () => {
    const space = synthesizeFsk([0], AUDIBLE_FREQ_0, AUDIBLE_FREQ_1, TARGET_SAMPLE_RATE);
    const mark = synthesizeFsk([1], AUDIBLE_FREQ_0, AUDIBLE_FREQ_1, TARGET_SAMPLE_RATE);
    const offset = Math.floor(space.length / 2) - GOERTZEL_WINDOW_SAMPLES / 2;
    expect(
      classifyWindow(windowSlice(space, offset), AUDIBLE_FREQ_0, AUDIBLE_FREQ_1, TARGET_SAMPLE_RATE),
    ).toBe(0);
    expect(
      classifyWindow(windowSlice(mark, offset), AUDIBLE_FREQ_0, AUDIBLE_FREQ_1, TARGET_SAMPLE_RATE),
    ).toBe(1);
  });

  it("decodes a live-style sliding-window ultrasonic frame with irregular hops", () => {
    const framed = encodeMessage("hello fsk");
    const audio = synthesizeFsk(framed, ULTRASONIC_FREQ_0, ULTRASONIC_FREQ_1);
    const slicer = new BitSlicer();
    let start = 0;
    let hopIndex = 0;
    while (start + GOERTZEL_WINDOW_SAMPLES <= audio.length) {
      const window = audio.subarray(start, start + GOERTZEL_WINDOW_SAMPLES);
      const now = (start / TARGET_SAMPLE_RATE) * 1000;
      const decision = classifyWindow(window, ULTRASONIC_FREQ_0, ULTRASONIC_FREQ_1);
      slicer.push(now, decision);
      start += IRREGULAR_HOPS[hopIndex % IRREGULAR_HOPS.length];
      hopIndex += 1;
    }
    slicer.push((audio.length / TARGET_SAMPLE_RATE) * 1000 + 400, null);
    const decoded = decodeFramedBits(slicer.bits);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.text).toBe("hello fsk");
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  MAX_EVENT_IMAGES,
  nextIndex,
  prevIndex,
  normalizeEventImages,
  shouldAutoplay,
} from "./event-images";

const u = (n: number) => `https://res.cloudinary.com/demo/image/upload/img${n}.jpg`;

describe("normalizeEventImages", () => {
  it("keeps valid urls in order", () => {
    expect(normalizeEventImages([u(1), u(2)], "demo")).toEqual([u(1), u(2)]);
  });
  it("drops non-cloudinary, http, non-string and other-account urls", () => {
    const input = [u(1), "http://res.cloudinary.com/demo/a.jpg", "https://evil.com/a.jpg", 5, null, "https://res.cloudinary.com/other/a.jpg"];
    expect(normalizeEventImages(input, "demo")).toEqual([u(1)]);
  });
  it("dedupes keeping first occurrence", () => {
    expect(normalizeEventImages([u(1), u(2), u(1)], "demo")).toEqual([u(1), u(2)]);
  });
  it("caps at the maximum", () => {
    const many = Array.from({ length: MAX_EVENT_IMAGES + 5 }, (_, i) => u(i));
    expect(normalizeEventImages(many, "demo")).toHaveLength(MAX_EVENT_IMAGES);
  });
  it("returns empty for non-arrays", () => {
    expect(normalizeEventImages("x", "demo")).toEqual([]);
    expect(normalizeEventImages(undefined, "demo")).toEqual([]);
  });
});

describe("carousel index math", () => {
  it("wraps forward and backward", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(2, 3)).toBe(1);
  });
  it("is stable with 0 or 1 items", () => {
    expect(nextIndex(0, 1)).toBe(0);
    expect(prevIndex(0, 1)).toBe(0);
    expect(nextIndex(0, 0)).toBe(0);
  });
});

describe("shouldAutoplay", () => {
  const base = { count: 3, hovered: false, focused: false, hidden: false, reducedMotion: false };
  it("plays when idle with several images", () => {
    expect(shouldAutoplay(base)).toBe(true);
  });
  it("pauses on hover, focus, hidden tab, reduced motion or single image", () => {
    expect(shouldAutoplay({ ...base, hovered: true })).toBe(false);
    expect(shouldAutoplay({ ...base, focused: true })).toBe(false);
    expect(shouldAutoplay({ ...base, hidden: true })).toBe(false);
    expect(shouldAutoplay({ ...base, reducedMotion: true })).toBe(false);
    expect(shouldAutoplay({ ...base, count: 1 })).toBe(false);
  });
});

import { sanitizeImageUrl } from "./ticket-design";

export const MAX_EVENT_IMAGES = 8;

/** Untrusted input -> ordered, deduped, Cloudinary-only https URLs (max 8). */
export function normalizeEventImages(raw: unknown, cloudName?: string | null): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const url = sanitizeImageUrl(item, cloudName);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_EVENT_IMAGES) break;
  }
  return out;
}

export function nextIndex(current: number, count: number): number {
  return count <= 1 ? 0 : (current + 1) % count;
}

export function prevIndex(current: number, count: number): number {
  return count <= 1 ? 0 : (current - 1 + count) % count;
}

export function shouldAutoplay(state: {
  count: number;
  hovered: boolean;
  focused: boolean;
  hidden: boolean;
  reducedMotion: boolean;
}): boolean {
  return state.count > 1 && !state.hovered && !state.focused && !state.hidden && !state.reducedMotion;
}

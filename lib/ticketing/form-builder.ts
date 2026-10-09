const MAX_BASE_LENGTH = 30;

/** Builds a schema-valid, unique field id (snake_case) from a human label. */
export function generateFieldId(label: string, existingIds: ReadonlySet<string>): string {
  let base = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_BASE_LENGTH)
    .replace(/_+$/g, "");
  if (!base) base = "campo";
  else if (!/^[a-z]/.test(base)) base = `campo_${base}`;

  if (!existingIds.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`;
    if (!existingIds.has(candidate)) return candidate;
  }
}

/** Returns a copy with the item at `from` moved to `to`; out of range moves are no-ops. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list];
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) return copy;
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

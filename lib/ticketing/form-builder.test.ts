import { describe, expect, it } from "vitest";
import { generateFieldId, moveItem } from "./form-builder";

describe("generateFieldId", () => {
  it("builds a valid snake_case id from the label, stripping accents", () => {
    expect(generateFieldId("Talla de camiseta", new Set())).toBe("talla_de_camiseta");
    expect(generateFieldId("¿Edad?", new Set())).toBe("edad");
  });
  it("falls back to 'campo' when the label has no usable characters", () => {
    expect(generateFieldId("???", new Set())).toBe("campo");
    expect(generateFieldId("123", new Set())).toBe("campo_123");
  });
  it("avoids collisions with existing ids", () => {
    expect(generateFieldId("Edad", new Set(["edad"]))).toBe("edad_2");
    expect(generateFieldId("Edad", new Set(["edad", "edad_2"]))).toBe("edad_3");
  });
  it("respects the 41 char id limit", () => {
    const id = generateFieldId("a".repeat(100), new Set());
    expect(id.length).toBeLessThanOrEqual(41);
    expect(/^[a-z][a-z0-9_]{0,40}$/.test(id)).toBe(true);
  });
});

describe("moveItem", () => {
  it("moves an item without mutating and ignores out of range moves", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(list, 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveItem(list, 2, 3)).toEqual(["a", "b", "c"]);
    expect(list).toEqual(["a", "b", "c"]);
  });
});

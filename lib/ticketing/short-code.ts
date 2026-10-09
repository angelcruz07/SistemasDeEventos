/** Crockford base32: digits and letters without I, L, O, U. */
export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 6;
export const MAX_CODE_ATTEMPTS = 5;

/** `randInt(max)` must return an integer in [0, max). Inject crypto.randomInt in production. */
export function generateShortCode(randInt: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randInt(CODE_ALPHABET.length)];
  return code;
}

/** "7K3Q9M" -> "7K3-Q9M" */
export function formatShortCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export function normalizeShortCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

/** Generates a code and runs `attempt`, retrying while it fails with a unique collision. */
export async function createWithUniqueCode<T>(
  generate: () => string,
  attempt: (code: string) => Promise<T>,
  isCollision: (error: unknown) => boolean,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    try {
      return await attempt(generate());
    } catch (error) {
      if (!isCollision(error)) throw error;
      last = error;
    }
  }
  throw new Error("Could not generate a unique ticket code", { cause: last });
}

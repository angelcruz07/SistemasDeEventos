const WEIGHTS = [3, 7, 1];

/** Validates an 18-digit CLABE including its check digit. */
export function isValidClabe(clabe: string): boolean {
  if (!/^\d{18}$/.test(clabe)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += (Number(clabe[i]) * WEIGHTS[i % 3]) % 10;
  return (10 - (sum % 10)) % 10 === Number(clabe[17]);
}

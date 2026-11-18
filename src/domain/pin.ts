/**
 * A PIN that hides the bad habits on this device. Only a salted PBKDF2 hash
 * is stored, never the PIN. This keeps out someone glancing at an unlocked
 * device; it is not encryption, and the data underneath stays readable to
 * anyone with access to the browser's storage.
 */
export interface PinLock {
  /** Base64 of the random salt. */
  salt: string;
  /** Base64 of the derived key. */
  hash: string;
  iterations: number;
}

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;
const ITERATIONS = 150_000;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin);
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function derive(
  pin: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function createPinLock(pin: string): Promise<PinLock> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, ITERATIONS);
  return { salt: toBase64(salt), hash: toBase64(hash), iterations: ITERATIONS };
}

export async function verifyPin(pin: string, lock: PinLock): Promise<boolean> {
  const actual = await derive(pin, fromBase64(lock.salt), lock.iterations);
  const expected = fromBase64(lock.hash);
  // Compare every byte so the time taken does not reveal how much matched.
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < Math.min(actual.length, expected.length); i++) {
    difference |= actual[i]! ^ expected[i]!;
  }
  return difference === 0;
}

/** Seconds to wait after a run of wrong PINs: none for the first few, then longer. */
export function lockoutSeconds(failures: number): number {
  if (failures < 5) return 0;
  return Math.min(300, 30 * 2 ** (failures - 5));
}

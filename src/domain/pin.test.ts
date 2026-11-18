import { describe, expect, it } from 'vitest';
import { createPinLock, isValidPin, lockoutSeconds, verifyPin } from './pin';

describe('pin', () => {
  it('accepts 4 to 8 digits only', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('12345678')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('123456789')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });

  it('verifies the right PIN and rejects others, without storing the PIN', async () => {
    const lock = await createPinLock('4821');
    expect(JSON.stringify(lock)).not.toContain('4821');
    expect(await verifyPin('4821', lock)).toBe(true);
    expect(await verifyPin('4822', lock)).toBe(false);
    expect(await verifyPin('48210', lock)).toBe(false);
  });

  it('salts each lock, so the same PIN gives different hashes', async () => {
    const [a, b] = await Promise.all([createPinLock('0000'), createPinLock('0000')]);
    expect(a.hash).not.toBe(b.hash);
  });

  it('makes you wait longer after repeated wrong PINs', () => {
    expect(lockoutSeconds(4)).toBe(0);
    expect(lockoutSeconds(5)).toBe(30);
    expect(lockoutSeconds(6)).toBe(60);
    expect(lockoutSeconds(20)).toBe(300);
  });
});

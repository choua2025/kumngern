import bcrypt from 'bcrypt';
import { config } from '../config/index.js';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

let dummyHash: Promise<string> | undefined;

/**
 * Burns the same CPU time as a real check when the email does not exist.
 * Without it, "unknown email" answers in ~1 ms and "wrong password" in ~250 ms,
 * so an attacker could find out which emails are registered just by timing responses.
 */
export async function verifyAgainstDummyHash(password: string): Promise<false> {
  dummyHash ??= bcrypt.hash('dummy-password-for-timing', config.BCRYPT_COST);
  await bcrypt.compare(password, await dummyHash);
  return false;
}

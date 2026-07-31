import bcrypt from 'bcrypt';
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from './limits';

export const PASSWORD_SALT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH_10 = '$2b$10$8DV33TniVs1tV5octwGlWeJjGdFMr97ASVu3MkBw0W.1aDE/Gl3X2';
const DUMMY_PASSWORD_HASH_12 = '$2b$12$O25uQoPqRwoKnPcxxmkw5.wK1U/zIV3yVHEIP5Uuo6cLboIx2Zhmm';

export function getPasswordHashRounds(hash: string): number | null {
  try {
    const rounds = bcrypt.getRounds(hash);
    return Number.isInteger(rounds) && rounds > 0 ? rounds : null;
  } catch {
    return null;
  }
}

export function passwordHashNeedsUpgrade(hash: string): boolean {
  const rounds = getPasswordHashRounds(hash);
  return rounds !== null && rounds < PASSWORD_SALT_ROUNDS;
}

export async function verifyPasswordWithTimingPadding(
  password: string,
  passwordHash?: string,
): Promise<{ isValid: boolean; rounds: number | null; paddingRounds: number }> {
  const candidateHash = passwordHash ?? DUMMY_PASSWORD_HASH_12;
  const candidateRounds = getPasswordHashRounds(candidateHash);
  const paddingHash = candidateRounds !== null && candidateRounds < PASSWORD_SALT_ROUNDS
    ? DUMMY_PASSWORD_HASH_12
    : DUMMY_PASSWORD_HASH_10;
  const paddingRounds = getPasswordHashRounds(paddingHash)!;
  const [candidateIsValid] = await Promise.all([
    verifyPassword(password, candidateHash).catch(() => false),
    verifyPassword(password, paddingHash),
  ]);

  return {
    isValid: Boolean(passwordHash) && candidateIsValid,
    rounds: candidateRounds,
    paddingRounds,
  };
}

export function getPasswordValidationError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`;
  }

  if (new TextEncoder().encode(password).byteLength > MAX_PASSWORD_BYTES) {
    return `パスワードはUTF-8で${MAX_PASSWORD_BYTES}バイト以内にしてください`;
  }

  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

import { createHash, randomBytes } from 'node:crypto';

const REGISTRATION_INVITE_TOKEN_BYTES = 32;
const REGISTRATION_INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateRegistrationInviteToken(): string {
    return randomBytes(REGISTRATION_INVITE_TOKEN_BYTES).toString('base64url');
}

export function isRegistrationInviteToken(value: unknown): value is string {
    return typeof value === 'string' && REGISTRATION_INVITE_TOKEN_PATTERN.test(value);
}

export function hashRegistrationInviteToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function isRegistrationInviteUsable(invite: {
    expiresAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
}, now = new Date()): boolean {
    return invite.usedAt === null
        && invite.revokedAt === null
        && invite.expiresAt.getTime() > now.getTime();
}

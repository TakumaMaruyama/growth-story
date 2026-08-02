import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { redirect } from 'next/navigation';
import { generateSessionToken, hashSessionToken } from './session-token';
import { loginHref } from './return-path';
import { SESSION_COOKIE_SAME_SITE } from './session-cookie-policy';
export { hashPassword, verifyPassword } from './password';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_ACTIVE_SESSIONS_PER_USER = 5;
const LEGACY_COOKIE_NAME = 'session_token';
const SESSION_COOKIE_NAME = process.env.NODE_ENV === 'production'
    ? '__Host-swim_story_session'
    : 'swim_story_session';

export async function createSession(userId: string): Promise<string> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
                hashtextextended(${`session:${userId}`}, 0)
            )::text AS lock_result
        `;
        await tx.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });

        const activeSessions = await tx.session.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });
        const sessionsToRemove = activeSessions.slice(MAX_ACTIVE_SESSIONS_PER_USER - 1);
        if (sessionsToRemove.length > 0) {
            await tx.session.deleteMany({
                where: { id: { in: sessionsToRemove.map((session) => session.id) } },
            });
        }

        await tx.session.create({
            data: {
                userId,
                tokenHash: hashSessionToken(token),
                expiresAt,
            },
        });
    });

    return token;
}

export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(LEGACY_COOKIE_NAME);
    cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: SESSION_COOKIE_SAME_SITE,
        path: '/',
        maxAge: SESSION_DURATION_MS / 1000,
    });
}

export async function getSessionFromCookie() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const session = await prisma.session.findUnique({
        where: { tokenHash: hashSessionToken(token) },
        include: {
            user: {
                select: {
                    id: true,
                    loginId: true,
                    displayName: true,
                    email: true,
                    role: true,
                    isActive: true,
                    membershipStatus: true,
                    withdrawnAt: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
        },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
        await prisma.session.deleteMany({ where: { id: session.id } });
        return null;
    }
    if (!session.user.isActive) {
        await prisma.session.deleteMany({ where: { id: session.id } });
        return null;
    }

    return session;
}

export async function getCurrentUser() {
    const session = await getSessionFromCookie();
    return session?.user ?? null;
}

export async function requireUser(returnPath = '/') {
    const user = await getCurrentUser();
    if (!user) {
        redirect(loginHref(returnPath, 'user'));
    }
    if (user.role !== 'USER') {
        redirect('/admin/users');
    }
    return user;
}

export async function requireAdmin(returnPath = '/admin/users') {
    const user = await getCurrentUser();
    if (!user) {
        redirect(loginHref(returnPath, 'admin'));
    }
    if (user.role !== 'ADMIN') {
        redirect('/');
    }
    return user;
}

export async function logout(): Promise<void> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    try {
        if (token) {
            await prisma.session.deleteMany({
                where: { tokenHash: hashSessionToken(token) },
            });
        }
    } finally {
        cookieStore.delete(SESSION_COOKIE_NAME);
        cookieStore.delete(LEGACY_COOKIE_NAME);
    }
}

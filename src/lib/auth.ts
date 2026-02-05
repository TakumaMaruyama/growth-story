import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { redirect } from 'next/navigation';

const SALT_ROUNDS = 10;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function generateSessionToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSession(userId: string): Promise<string> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await prisma.session.create({
        data: {
            userId,
            token,
            expiresAt,
        },
    });

    return token;
}

export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_DURATION_MS / 1000,
    });
}

export async function getSessionFromCookie() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (!token) return null;

    const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
        await prisma.session.delete({ where: { id: session.id } });
        return null;
    }
    if (!session.user.isActive) {
        await prisma.session.delete({ where: { id: session.id } });
        return null;
    }

    return session;
}

export async function getCurrentUser() {
    const session = await getSessionFromCookie();
    return session?.user ?? null;
}

export async function requireUser() {
    const user = await getCurrentUser();
    if (!user) {
        redirect('/login');
    }
    return user;
}

export async function requireAdmin() {
    const user = await requireUser();
    if (user.role !== 'ADMIN') {
        redirect('/');
    }
    return user;
}

export async function logout(): Promise<void> {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    if (token) {
        await prisma.session.deleteMany({ where: { token } });
    }
    cookieStore.delete('session_token');
}

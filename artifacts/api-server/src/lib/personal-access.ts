import { Prisma } from '@prisma/client';
import { getSessionFromCookie } from './auth';
import { prisma } from './prisma';
import { jsonResponse } from './request';
import type { NextRequest } from './express-compat';

export const EXPECTED_PERSONAL_USER_HEADER = 'X-Expected-Personal-User-Id';
const UNAVAILABLE_MESSAGE = '本人の会員ページへの切替は現在利用できません。管理画面で確認してください。';
const CHANGED_MESSAGE = 'ログイン中のアカウントまたは会員ページの対象が変わりました。入力は未保存です。必要な内容をコピーしてから再読み込みしてください。';

/** Server configuration only: never resolve a pair from a client id or a name. */
function configuredPair() {
    const adminId = process.env.ADMIN_PERSONAL_ADMIN_USER_ID?.trim();
    const memberId = process.env.ADMIN_PERSONAL_MEMBER_USER_ID?.trim();
    return adminId && memberId && adminId !== memberId ? { adminId, memberId } : null;
}

export interface PersonalWriteContext {
    sessionId: string;
    actorId: string;
    subjectId: string;
    paired: boolean;
}

export class PersonalAccessError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) {
        super(message);
    }
}

export function personalAccessErrorResponse(error: unknown) {
    return error instanceof PersonalAccessError
        ? jsonResponse({ error: error.message, code: error.code }, error.status)
        : null;
}

function unavailable() {
    return new PersonalAccessError(403, 'PERSONAL_ACCESS_UNAVAILABLE', UNAVAILABLE_MESSAGE);
}

async function resolvePersonalAccess() {
    const session = await getSessionFromCookie();
    if (!session) throw new PersonalAccessError(401, 'AUTH_REQUIRED', '認証が必要です');
    const actor = session.user;
    let subject = actor;
    const paired = actor.role === 'ADMIN';
    if (paired) {
        const pair = configuredPair();
        if (!pair || pair.adminId !== actor.id) throw unavailable();
        const member = await prisma.user.findUnique({ where: { id: pair.memberId }, select: {
            id: true, loginId: true, displayName: true, email: true, role: true, isActive: true,
            membershipStatus: true, withdrawnAt: true, createdAt: true, updatedAt: true,
        } });
        if (!member || member.role !== 'USER' || !member.isActive) throw unavailable();
        subject = member;
    } else if (actor.role !== 'USER') {
        throw unavailable();
    }
    return { actor, subject, canSwitchToAdmin: paired, writeContext: {
        sessionId: session.id, actorId: actor.id, subjectId: subject.id, paired,
    } satisfies PersonalWriteContext };
}

export async function authorizePersonalRequest(request?: NextRequest) {
    try {
        const access = await resolvePersonalAccess();
        if (request && request.headers.get(EXPECTED_PERSONAL_USER_HEADER) !== access.subject.id) {
            throw new PersonalAccessError(409, 'PERSONAL_SUBJECT_CHANGED', CHANGED_MESSAGE);
        }
        return { access } as const;
    } catch (error) {
        const response = personalAccessErrorResponse(error);
        if (response) return { response } as const;
        throw error;
    }
}

export async function accountSwitchCapability() {
    const session = await getSessionFromCookie();
    if (!session) return jsonResponse({ error: '認証が必要です' }, 401);
    if (session.user.role !== 'ADMIN') return jsonResponse({ canSwitchToMember: false });
    const authorization = await authorizePersonalRequest();
    return jsonResponse({ canSwitchToMember: 'response' in authorization ? false : authorization.access.canSwitchToAdmin });
}

/** Called after the subject's member-write advisory lock, inside READ COMMITTED. */
export async function assertPersonalWriteAuthorization(
    tx: Prisma.TransactionClient, userId: string, context: PersonalWriteContext,
) {
    if (userId !== context.subjectId) throw unavailable();
    // User updates (including toggle/reset) precede session deletion. Use the
    // same order; sorted ids keep paired writes consistent. SHARE also blocks
    // ordinary UPDATEs from paths which do not take the member advisory lock.
    await tx.$queryRaw`SELECT id FROM users
        WHERE id IN (${context.actorId}, ${context.subjectId}) ORDER BY id FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${context.sessionId} FOR SHARE`;
    const [actor, subject, session] = await Promise.all([
        tx.user.findUnique({ where: { id: context.actorId } }),
        tx.user.findUnique({ where: { id: context.subjectId } }),
        tx.session.findUnique({ where: { id: context.sessionId } }),
    ]);
    if (!session || session.userId !== context.actorId || session.expiresAt <= new Date()
        || !actor?.isActive) {
        throw new PersonalAccessError(401, 'AUTH_REQUIRED', '認証が必要です');
    }
    const pair = configuredPair();
    if (!subject?.isActive || subject.role !== 'USER'
        || (context.paired
            ? actor.role !== 'ADMIN' || !pair || pair.adminId !== actor.id || pair.memberId !== subject.id
            : actor.role !== 'USER' || actor.id !== subject.id)) {
        throw unavailable();
    }
}

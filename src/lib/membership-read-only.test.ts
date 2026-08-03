import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function readSource(relativePath: string): Promise<string> {
    return readFile(path.join(process.cwd(), relativePath), 'utf8');
}

test('every member content mutation route rejects withdrawn writes with one stable code', async () => {
    const mutationRoutes = [
        'src/app/api/daily/route.ts',
        'src/app/api/story/route.ts',
        'src/app/api/goals/route.ts',
        'src/app/api/goals/[goalId]/route.ts',
        'src/app/api/goals/[goalId]/permanent/route.ts',
    ];

    for (const route of mutationRoutes) {
        const source = await readSource(route);
        assert.match(source, /canMemberWrite/, `${route} must reject known withdrawn sessions early`);
        assert.match(source, /MEMBERSHIP_WITHDRAWN_CODE/, `${route} must return the stable client error code`);
        assert.match(source, /MembershipWriteBlockedError/, `${route} must handle a withdrawal racing the write`);
    }
});

test('content services check membership in the same transaction as the write', async () => {
    const writeServices = [
        'src/lib/daily-log-service.ts',
        'src/lib/story-service.ts',
        'src/lib/competition-goal-service.ts',
    ];

    for (const service of writeServices) {
        const source = await readSource(service);
        assert.match(
            source,
            /assertMemberWritableInTransaction/,
            `${service} must close the membership-check/write race`,
        );
    }

    const accessSource = await readSource('src/lib/member-access.ts');
    assert.match(accessSource, /member-write:/);
    assert.match(accessSource, /membershipStatus === 'ACTIVE'/);
});

test('withdrawn membership remains part of read responses and does not disable login sessions', async () => {
    const readRoutes = [
        'src/app/api/daily/route.ts',
        'src/app/api/story/route.ts',
        'src/app/api/goals/route.ts',
    ];
    for (const route of readRoutes) {
        assert.match(await readSource(route), /membershipStatus: user\.membershipStatus/);
    }

    const authSource = await readSource('src/lib/auth.ts');
    assert.match(authSource, /membershipStatus: true/);
    assert.doesNotMatch(
        authSource,
        /if\s*\(\s*session\.user\.membershipStatus\s*===\s*['"]WITHDRAWN['"]\s*\)/,
        'withdrawal must not invalidate the session because historical reads remain available',
    );
});

test('shared registration stays link-gated and requires guardian consent', async () => {
    const routeSource = await readSource('src/app/api/auth/register/route.ts');
    assert.match(routeSource, /parseSharedRegistrationInput/);
    assert.match(routeSource, /isSharedRegistrationAccessAllowed/);
    assert.match(routeSource, /registerUserWithGuardianConsent/);
    assert.doesNotMatch(routeSource, /parseAccountInput/);

    const pageSource = await readSource('src/app/register/page.tsx');
    assert.match(pageSource, /window\.location\.hash/);
    assert.match(pageSource, /window\.history\.replaceState/);
    assert.match(pageSource, /guardianConsent/);
    assert.match(pageSource, /onChange=.*setAthleteName/);

    const accessRouteSource = await readSource('src/app/api/auth/register/access/route.ts');
    assert.match(accessRouteSource, /readJsonObject/);
    assert.match(accessRouteSource, /isSharedRegistrationAccessAllowed/);
    const registerLayoutSource = await readSource('src/app/register/layout.tsx');
    assert.match(registerLayoutSource, /referrer:\s*'no-referrer'/);

    const adminSource = await readSource('src/app/admin/users/page.tsx');
    assert.match(adminSource, /共通の会員登録URL/);
    assert.doesNotMatch(adminSource, /1選手につき1回/);
    assert.doesNotMatch(adminSource, /registration-invites/);
});

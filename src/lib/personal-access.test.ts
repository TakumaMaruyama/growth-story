import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Run the actual server modules with isolated dependencies: no session, database,
// or rate-limit records are created by these authorization regression checks.
function loadServerModule(file: string, dependencies: Record<string, unknown>) {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
    vm.runInNewContext(output, {
        exports,
        require(name: string) {
            assert.ok(name in dependencies, `Missing isolated dependency: ${name}`);
            return dependencies[name];
        },
        process: { env: { NODE_ENV: 'test' } },
        Date,
        console,
    });
    return exports;
}

function user(role: 'USER' | 'ADMIN') {
    return { id: `${role.toLowerCase()}-self`, role, displayName: '本人', membershipStatus: 'ACTIVE' };
}

const jsonResponse = (body: unknown, status = 200) => ({ body, status });
const membership = {
    canMemberWrite: () => true,
    MembershipWriteBlockedError: class extends Error {},
};

test('personal story reads and writes use the authenticated account for both roles', async () => {
    for (const role of ['USER', 'ADMIN'] as const) {
        const currentUser = user(role);
        const owners: string[] = [];
        const route = loadServerModule('src/app/api/story/route.ts', {
            '@prisma/client': { Prisma: {} },
            'next/server': {},
            '@/lib/auth': { getCurrentUser: async () => currentUser },
            '@/lib/prisma': { prisma: { storyVersion: { findFirst: async (query: { where: { userId: string } }) => {
                owners.push(query.where.userId);
                return null;
            } } } },
            '@/lib/request': { jsonResponse, readJsonObject: async () => ({ ok: true, data: { userId: 'other-user' } }) },
            '@/lib/validation': { parseStoryInput: (input: unknown) => ({ ok: true, value: input }) },
            '@/lib/limits': {},
            '@/lib/rate-limit': { consumeRateLimits: async () => ({ allowed: true }) },
            '@/lib/story-write-rate-limit': { storyWriteRateLimitRules: () => [] },
            '@/lib/member-access': membership,
            '@/lib/story-service': { saveStoryVersion: async (owner: string) => {
                owners.push(owner);
                return { version: 1 };
            } },
        });
        const response = await route.GET!() as { status: number; body: { user: { role: string } } };
        assert.equal(response.status, 200);
        assert.equal(response.body.user.role, role);
        assert.equal((await route.POST!({}) as { status: number }).status, 200);
        assert.deepEqual(owners, [currentUser.id, currentUser.id]);
    }
});

test('personal goal reads and creates use the authenticated account for both roles', async () => {
    for (const role of ['USER', 'ADMIN'] as const) {
        const currentUser = user(role);
        const owners: string[] = [];
        const route = loadServerModule('src/app/api/goals/route.ts', {
            'next/server': {},
            '@/lib/auth': { getCurrentUser: async () => currentUser },
            '@/lib/competition-goal-contract': { serializeCompetitionGoal: (goal: unknown) => goal },
            '@/lib/competition-goal-rate-limit': { competitionGoalWriteRateLimitRules: () => [] },
            '@/lib/competition-goal-service': {
                listCompetitionGoals: async (owner: string) => { owners.push(owner); return []; },
                createCompetitionGoal: async (owner: string) => { owners.push(owner); return { id: 'new-goal' }; },
            },
            '@/lib/competition-goal-validation': { parseCompetitionGoalCreateInput: (input: unknown) => ({ ok: true, value: input }) },
            '@/lib/rate-limit': { consumeRateLimits: async () => ({ allowed: true }) },
            '@/lib/request': { jsonResponse, readJsonObject: async () => ({ ok: true, data: { userId: 'other-user' } }) },
            '@/lib/member-access': membership,
        });
        const response = await route.GET!() as { status: number; body: { user: { role: string } } };
        assert.equal(response.status, 200);
        assert.equal(response.body.user.role, role);
        assert.equal((await route.POST!({}) as { status: number }).status, 201);
        assert.deepEqual(owners, [currentUser.id, currentUser.id]);
    }
});

test('personal page access accepts admins while administration still rejects ordinary users and guests', async () => {
    for (const currentUser of [user('ADMIN'), user('USER'), null]) {
        const auth = loadServerModule('src/lib/auth.ts', {
            'next/headers': { cookies: async () => ({ get: () => currentUser ? { value: 'test-token' } : undefined }) },
            './prisma': { prisma: { session: { findUnique: async () => ({
                expiresAt: new Date(Date.now() + 60_000),
                user: { ...currentUser, isActive: true },
            }) } } },
            'next/navigation': { redirect: (destination: string) => { throw new Error(`redirect:${destination}`); } },
            './session-token': { hashSessionToken: () => 'test-hash' },
            './return-path': { loginHref: (_: unknown, scope: string) => scope === 'admin' ? '/admin/login' : '/login' },
            './session-cookie-policy': {},
            './password': {},
        });
        if (!currentUser) {
            await assert.rejects(auth.requireUser!(), /redirect:\/login/);
            await assert.rejects(auth.requireAdmin!(), /redirect:\/admin\/login/);
        } else {
            assert.equal((await auth.requireUser!() as { id: string }).id, currentUser.id);
            if (currentUser.role === 'ADMIN') {
                assert.equal((await auth.requireAdmin!() as { id: string }).id, currentUser.id);
            } else {
                await assert.rejects(auth.requireAdmin!(), /^Error: redirect:\/$/);
            }
        }
    }
});

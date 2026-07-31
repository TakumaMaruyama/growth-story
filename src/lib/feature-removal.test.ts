import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const FORBIDDEN_ACTIVE_REFERENCES = [
    '/growth',
    'growthMeasurement',
    'growthProfile',
    'GrowthMeasurement',
    'GrowthProfile',
    'predictAdultHeight',
    'kr_coeff',
    '身長',
    '成長記録',
] as const;

async function collectSourceFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectSourceFiles(target);
        if (/\.(?:ts|tsx|css)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) return [target];
        return [];
    }));
    return nested.flat();
}

test('removed feature has no active source, schema or documentation references', async () => {
    const workspace = process.cwd();
    const files = [
        ...await collectSourceFiles(path.join(workspace, 'src')),
        path.join(workspace, 'prisma/schema.prisma'),
        path.join(workspace, 'README.md'),
        path.join(workspace, 'package.json'),
    ];

    const violations: string[] = [];
    for (const file of files) {
        const content = await readFile(file, 'utf8');
        for (const reference of FORBIDDEN_ACTIVE_REFERENCES) {
            if (content.includes(reference)) {
                violations.push(`${path.relative(workspace, file)}: ${reference}`);
            }
        }
    }

    assert.deepEqual(violations, []);
});

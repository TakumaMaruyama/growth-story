import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { readJsonObject } from './request';

function jsonRequest(body: string, extraHeaders: Record<string, string> = {}) {
    return new NextRequest('https://example.test/api/test', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            origin: 'https://example.test',
            ...extraHeaders,
        },
        body,
    });
}

test('JSON reader accepts a same-origin object', async () => {
    const result = await readJsonObject(jsonRequest('{"value":1}'), 128);
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.data, { value: 1 });
});

test('JSON reader stops oversized bodies even without a declared length', async () => {
    const result = await readJsonObject(jsonRequest(JSON.stringify({ value: 'x'.repeat(256) })), 64);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.response.status, 413);
});

test('JSON reader rejects cross-site origins before reading the body', async () => {
    const result = await readJsonObject(jsonRequest('{}', { origin: 'https://attacker.test' }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.response.status, 403);
});

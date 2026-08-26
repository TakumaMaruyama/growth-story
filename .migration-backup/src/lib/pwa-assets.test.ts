import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function readSource(relativePath: string): Promise<string> {
    return readFile(path.join(process.cwd(), relativePath), 'utf8');
}

async function pngDimensions(relativePath: string): Promise<{ width: number; height: number }> {
    const data = await readFile(path.join(process.cwd(), relativePath));
    assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

test('web app manifest defines standalone identity and install icons', async () => {
    const source = await readSource('src/app/manifest.ts');

    assert.match(source, /name: '私の競泳物語'/);
    assert.match(source, /short_name: '競泳物語'/);
    assert.match(source, /start_url: '\/'/);
    assert.match(source, /display: 'standalone'/);
    assert.match(source, /background_color: '#f4f7fb'/);
    assert.match(source, /theme_color: '#1d4ed8'/);
    assert.match(source, /src: '\/icons\/icon-192\.png'/);
    assert.match(source, /src: '\/icons\/icon-512\.png'/);
    assert.match(source, /src: '\/icons\/icon-maskable-512\.png'/);
    assert.match(source, /purpose: 'maskable'/);
});

test('home-screen PNG assets have the declared dimensions', async () => {
    assert.deepEqual(await pngDimensions('public/icons/icon-192.png'), { width: 192, height: 192 });
    assert.deepEqual(await pngDimensions('public/icons/icon-512.png'), { width: 512, height: 512 });
    assert.deepEqual(await pngDimensions('public/icons/icon-maskable-512.png'), { width: 512, height: 512 });
    assert.deepEqual(await pngDimensions('src/app/icon.png'), { width: 512, height: 512 });
    assert.deepEqual(await pngDimensions('src/app/apple-icon.png'), { width: 180, height: 180 });
    assert.deepEqual(await pngDimensions('assets/app-icon-master.png'), { width: 1024, height: 1024 });
});

test('root metadata exposes the manifest, Apple mode and light-dark theme colors', async () => {
    const source = await readSource('src/app/layout.tsx');

    assert.match(source, /manifest: "\/manifest\.webmanifest"/);
    assert.match(source, /appleWebApp:/);
    assert.match(source, /viewportFit: "cover"/);
    assert.match(source, /prefers-color-scheme: light/);
    assert.match(source, /prefers-color-scheme: dark/);
});

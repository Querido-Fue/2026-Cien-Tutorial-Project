import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    BrowserFileSystem,
    browserPath,
} from '../project/engine/script/util/_browser_file_system.js';
import {
    isNwRuntime,
    runtimeRoot,
} from '../project/engine/script/util/nw_bridge.js';
import { buildWeb } from '../scripts/build-web.mjs';

class TestStorage {
    constructor() {
        this.entries = new Map();
    }

    getItem(key) {
        return this.entries.has(key) ? this.entries.get(key) : null;
    }

    setItem(key, value) {
        this.entries.set(key, String(value));
    }
}

test('브라우저 저장 어댑터가 JSON 텍스트와 진행도 바이트를 보존한다', async () => {
    const storage = new TestStorage();
    const fileSystem = new BrowserFileSystem(storage);
    await fileSystem.mkdir('/nthplayer/save', { recursive: true });

    const settingsPath = browserPath.join('/nthplayer', 'save', 'settings.json');
    await fileSystem.writeFile(settingsPath, '{"theme":"dark"}');
    assert.equal(await fileSystem.readFile(settingsPath, 'utf-8'), '{"theme":"dark"}');

    const progressPath = browserPath.join('/nthplayer', 'save', 'progress.dat');
    await fileSystem.writeFile(progressPath, Uint8Array.from([0, 1, 127, 255]));
    assert.deepEqual(await fileSystem.readFile(progressPath), Uint8Array.from([0, 1, 127, 255]));

    const secondInstance = new BrowserFileSystem(storage);
    assert.equal(await secondInstance.readFile(settingsPath, 'utf-8'), '{"theme":"dark"}');
});

test('브라우저 저장 경로는 상위 디렉터리 탈출을 거부한다', () => {
    assert.throws(() => browserPath.join('/nthplayer', '..', 'settings.json'), { code: 'EINVAL' });
});

test('Node 테스트 환경에서는 NW.js가 아닌 웹 런타임 경계가 선택된다', () => {
    assert.equal(isNwRuntime(), false);
    assert.equal(runtimeRoot, '/nthplayer');
});

test('웹 빌드는 Pages 하위 경로에서 동작하는 정적 번들을 만든다', async (t) => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'nthplayer-web-build-'));
    t.after(async () => rm(temporaryRoot, { recursive: true, force: true }));
    const outputRoot = path.join(temporaryRoot, 'web');

    await buildWeb({ outputRoot });

    const indexHtml = await readFile(path.join(outputRoot, 'index.html'), 'utf-8');
    const styleSheet = await readFile(path.join(outputRoot, 'style.css'), 'utf-8');
    const assetManifest = await readFile(
        path.join(outputRoot, 'script', 'data', 'game', 'tutorial_assets', '_tutorial_map_asset_entries.js'),
        'utf-8',
    );

    assert.match(indexHtml, /<title>Nth Player<\/title>/);
    assert.match(indexHtml, /href="\.\/asset\/old\/icon\/logo\.ico"/);
    assert.doesNotMatch(indexHtml, /\.\.\/asset\//);
    assert.match(styleSheet, /url\('\.\/asset\/font\/LanaPixel\.ttf'\)/);
    assert.doesNotMatch(assetManifest, /\.\.\/asset\//);
    assert.match(assetManifest, /runtimePath: '\.\/asset\/tutorial\/maps\/first-floor-background\.png'/);

    await stat(path.join(outputRoot, '.nojekyll'));
    await stat(path.join(outputRoot, 'asset', 'font', 'LanaPixel.ttf'));
    await stat(path.join(outputRoot, 'asset', 'tutorial', 'maps', 'first-floor-background.png'));
});

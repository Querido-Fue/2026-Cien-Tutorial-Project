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
import nthplayerWorker, {
    createUpstreamUrl,
    resolvePublicCacheControl,
} from '../scripts/cloudflare/nthplayer-worker.js';

const RELEASE_FIXTURE = Object.freeze({
    schemaVersion: 1,
    id: '0830_0520-abcdef1',
    version: '0830_0520',
    commit: 'abcdef1234567890abcdef1234567890abcdef12',
    builtAtKst: '2026-08-30T05:20:00+09:00',
    changelog: Object.freeze([
        Object.freeze({
            version: '0830_0500',
            commit: '2b73ac5',
            summary: '마우스 휠 카메라 확대·축소를 추가했습니다.'
        })
    ])
});

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

    await buildWeb({ outputRoot, releaseManifest: RELEASE_FIXTURE });

    const indexHtml = await readFile(path.join(outputRoot, 'index.html'), 'utf-8');
    const styleSheet = await readFile(path.join(outputRoot, 'style.css'), 'utf-8');
    const assetManifest = await readFile(
        path.join(outputRoot, 'script', 'data', 'game', 'tutorial_assets', '_tutorial_map_asset_entries.js'),
        'utf-8',
    );
    const audioManifest = await readFile(
        path.join(outputRoot, 'script', 'data', 'sound', '_tutorial_sfx_entries.js'),
        'utf-8',
    );
    const itemManifest = await readFile(
        path.join(
            outputRoot,
            'script',
            'data',
            'game',
            'tutorial_assets',
            '_tutorial_item_asset_entries.js'
        ),
        'utf-8',
    );
    const releaseManifest = JSON.parse(await readFile(
        path.join(outputRoot, 'release.json'),
        'utf-8',
    ));

    assert.match(indexHtml, /<title>Nth Player<\/title>/);
    assert.match(indexHtml, /href="\.\/asset\/old\/icon\/logo\.ico\?v=0830_0520-abcdef1"/);
    assert.match(indexHtml, /content="0830_0520-abcdef1"/);
    assert.match(
        indexHtml,
        /src="\.\/releases\/0830_0520-abcdef1\/script\/main\.js"/
    );
    assert.doesNotMatch(indexHtml, /\.\.\/asset\//);
    assert.match(styleSheet, /url\('\.\/asset\/font\/LanaPixel\.ttf\?v=0830_0520-abcdef1'\)/);
    assert.doesNotMatch(assetManifest, /\.\.\/asset\//);
    assert.match(
        assetManifest,
        /runtimePath: '\.\/asset\/tutorial\/maps\/first-floor-background\.png\?v=0830_0520-abcdef1'/
    );
    assert.match(
        audioManifest,
        /runtimePath: `\.\/asset\/tutorial\/audio\/sfx\/\$\{runtimeName\}\.mp3`/
    );
    assert.doesNotMatch(audioManifest, /\.mp3`,\?v=/);
    assert.match(
        itemManifest,
        /runtimePath: '\.\/asset\/tutorial\/ui\/items\/'\s*\+ itemId/
    );
    assert.doesNotMatch(itemManifest, /items\/\?v=/);
    assert.deepEqual(releaseManifest, RELEASE_FIXTURE);

    await stat(path.join(outputRoot, '.nojekyll'));
    await stat(path.join(
        outputRoot,
        'releases',
        RELEASE_FIXTURE.id,
        'script',
        'main.js'
    ));
    await stat(path.join(outputRoot, 'asset', 'font', 'LanaPixel.ttf'));
    await stat(path.join(outputRoot, 'asset', 'tutorial', 'maps', 'first-floor-background.png'));
});

test('Cloudflare 경로 프록시는 공개 경로와 쿼리를 Pages 업스트림으로 옮긴다', () => {
    const upstreamUrl = createUpstreamUrl(new URL('https://jukchang.com/game/nthplayer/asset/ui.png?v=7'));
    assert.equal(
        upstreamUrl.href,
        'https://querido-fue.github.io/2026-Cien-Tutorial-Project/asset/ui.png?v=7',
    );
});

test('Cloudflare 경로 프록시는 릴리스 확인과 버전 자산의 캐시 수명을 분리한다', () => {
    assert.equal(
        resolvePublicCacheControl(new URL('https://jukchang.com/game/nthplayer/release.json')),
        'no-store, max-age=0'
    );
    assert.equal(
        resolvePublicCacheControl(new URL(
            'https://jukchang.com/game/nthplayer/releases/0830_0520-abcdef1/script/main.js'
        )),
        'public, max-age=31536000, immutable'
    );
    assert.equal(
        resolvePublicCacheControl(new URL(
            'https://jukchang.com/game/nthplayer/script/main.js'
        )),
        'no-cache, max-age=0, must-revalidate'
    );
    assert.equal(
        resolvePublicCacheControl(new URL(
            'https://jukchang.com/game/nthplayer/asset/tutorial/ui/items/bow.png'
        )),
        'no-cache, max-age=0, must-revalidate'
    );
});

test('Cloudflare 경로 프록시는 기준 경로에 후행 슬래시를 강제한다', async () => {
    const response = await nthplayerWorker.fetch(new Request('https://jukchang.com/game/nthplayer?from=home'));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), 'https://jukchang.com/game/nthplayer/?from=home');
});

test('Cloudflare 경로 프록시는 기존 루트 준비 중 화면을 보존한다', async () => {
    const outsideResponse = await nthplayerWorker.fetch(new Request('https://jukchang.com/'));
    assert.equal(outsideResponse.status, 200);
    assert.match(await outsideResponse.text(), /<title>Coming Soon!<\/title>/);

    const headResponse = await nthplayerWorker.fetch(new Request(
        'https://www.jukchang.com/',
        { method: 'HEAD' },
    ));
    assert.equal(headResponse.status, 200);
    assert.equal(await headResponse.text(), '');
});

test('Cloudflare 경로 프록시는 쓰기 요청을 거부한다', async () => {
    const writeResponse = await nthplayerWorker.fetch(new Request(
        'https://jukchang.com/game/nthplayer/save',
        { method: 'POST' },
    ));
    assert.equal(writeResponse.status, 405);
    assert.equal(writeResponse.headers.get('allow'), 'GET, HEAD');
});

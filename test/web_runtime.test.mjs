import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PRESENTATION_ROOT = path.resolve(
    TEST_DIRECTORY,
    '..',
    'project',
    'presentation',
    'public',
    'ppt',
    'nthplayer'
);

/** @param {string} source @param {RegExp} pattern @returns {number} 정규식 일치 수입니다. */
const countMatches = (source, pattern) => [...source.matchAll(pattern)].length;

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
    assert.match(
        indexHtml,
        /href="\.\/asset\/font\/OwnglyphParkDahyun\.ttf\?v=0830_0520-abcdef1"/
    );
    assert.doesNotMatch(indexHtml, /\.\.\/asset\//);
    assert.match(
        styleSheet,
        /url\('\.\/asset\/font\/OwnglyphParkDahyun\.ttf\?v=0830_0520-abcdef1'\)/
    );
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
    await stat(path.join(outputRoot, 'asset', 'font', 'OwnglyphParkDahyun.ttf'));
    await assert.rejects(() => stat(path.join(outputRoot, 'asset', 'font', 'LanaPixel.ttf')));
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

test('웹 발표는 15장 연속 장면과 미리 로드한 게임 프레임을 함께 제공한다', async () => {
    const indexHtml = await readFile(path.join(PRESENTATION_ROOT, 'index.html'), 'utf-8');
    const styleSheet = await readFile(path.join(PRESENTATION_ROOT, 'presentation.css'), 'utf-8');
    const slideStyleSheet = await readFile(path.join(PRESENTATION_ROOT, 'slides.css'), 'utf-8');
    const controller = await readFile(path.join(PRESENTATION_ROOT, 'presentation.js'), 'utf-8');
    const deckController = await readFile(
        path.join(PRESENTATION_ROOT, 'presentation-deck.js'),
        'utf-8'
    );

    assert.equal(countMatches(indexHtml, /\sdata-slide(?:\s|>)/g), 15);
    assert.match(indexHtml, /data-prototype-slide/);
    assert.match(indexHtml, /id="prototype-fullscreen"/);
    assert.match(indexHtml, /data-source="\/game\/nthplayer\/"/);
    assert.match(indexHtml, /assets\/lora-dungeon-panorama-v1\.png|slides\.css/);
    assert.match(styleSheet, /--game-frame-opacity:\s*0/);
    assert.match(styleSheet, /transition-property:[^;]*width[^;]*height/);
    assert.match(slideStyleSheet, /\.prototype-frame-slot/);
    assert.match(slideStyleSheet, /body\.is-game-expanded/);
    assert.match(controller, /iframe\.loading = 'eager'/);
    assert.match(controller, /nthPlayerPresentation/);
    assert.match(controller, /setLayout\(layout = \{\}\)/);
    assert.match(controller, /PROTOTYPE_TRANSITION_MS = 600/);
    assert.match(controller, /contentWindow\?\.addEventListener\('keydown'/);
    assert.match(deckController, /class PresentationDeck/);
    assert.match(deckController, /event\.composedPath\(\)/);
    assert.match(deckController, /nthplayer:slide-change/);
});

test('Cloudflare Worker는 발표 경로와 정적 자산을 전용 바인딩으로 제공한다', async () => {
    const requestedUrls = [];
    const environment = {
        PRESENTATION_ASSETS: {
            async fetch(request) {
                requestedUrls.push(request.url);
                return new Response('<!doctype html><title>Presentation</title>', {
                    headers: { 'content-type': 'text/html; charset=utf-8' },
                });
            },
        },
    };

    const redirectResponse = await nthplayerWorker.fetch(new Request(
        'https://jukchang.com/ppt/nthplayer?draft=1'
    ), environment);
    assert.equal(redirectResponse.status, 308);
    assert.equal(
        redirectResponse.headers.get('location'),
        'https://jukchang.com/ppt/nthplayer/?draft=1'
    );

    const presentationResponse = await nthplayerWorker.fetch(new Request(
        'https://jukchang.com/ppt/nthplayer/'
    ), environment);
    assert.equal(presentationResponse.status, 200);
    assert.deepEqual(requestedUrls, ['https://jukchang.com/ppt/nthplayer/']);
    assert.equal(presentationResponse.headers.get('cache-control'), 'no-store, max-age=0');
    assert.match(presentationResponse.headers.get('content-security-policy'), /frame-src 'self'/);
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

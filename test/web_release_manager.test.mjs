import assert from 'node:assert/strict';
import test from 'node:test';

import { WebReleaseManager } from '../project/engine/script/release/_web_release_manager.js';

class TestStorage {
    constructor() {
        this.values = new Map();
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

/** @param {string} id @param {string} version @returns {object} */
function createDocument(id, version) {
    return {
        baseURI: 'https://jukchang.com/game/nthplayer/',
        querySelector(selector) {
            if (selector.includes('release-id')) {
                return { content: id };
            }
            if (selector.includes('release-version')) {
                return { content: version };
            }
            return null;
        }
    };
}

/** @param {TestStorage} storage @returns {{windowRef:object,replacements:string[]}} */
function createWindow(storage = new TestStorage()) {
    const replacements = [];
    return {
        replacements,
        windowRef: {
            location: {
                href: 'https://jukchang.com/game/nthplayer/?hpbar=top',
                replace(value) {
                    replacements.push(value);
                }
            },
            sessionStorage: storage
        }
    };
}

/** @param {string} id @param {string} version @returns {object} */
function createManifest(id, version) {
    return {
        schemaVersion: 1,
        id,
        version,
        commit: 'abcdef1234567890abcdef1234567890abcdef12',
        builtAtKst: '2026-08-30T05:20:00+09:00',
        changelog: [{
            version,
            commit: 'abcdef1',
            summary: '최신 배포 자동 갱신을 추가했습니다.'
        }]
    };
}

test('현재 웹 문서가 최신이면 서버 체인지로그를 사용하고 다시 불러오지 않는다', async () => {
    const { windowRef, replacements } = createWindow();
    const manifest = createManifest('0830_0520-abcdef1', '0830_0520');
    const requestedUrls = [];
    const manager = new WebReleaseManager({
        windowRef,
        documentRef: createDocument(manifest.id, manifest.version),
        now: () => 1234,
        fetchImpl: async (url, options) => {
            requestedUrls.push({ url, options });
            return { ok: true, json: async () => manifest };
        }
    });

    const state = await manager.ensureLatest();
    assert.equal(state.reloadScheduled, false);
    assert.equal(state.releaseInfo.id, manifest.id);
    assert.equal(state.releaseInfo.changelog[0].summary, manifest.changelog[0].summary);
    assert.deepEqual(replacements, []);
    assert.match(requestedUrls[0].url, /release\.json\?check=1234$/);
    assert.equal(requestedUrls[0].options.cache, 'no-store');
});

test('구버전 웹 문서는 최신 내부 ID로 한 번만 캐시 우회 재접속한다', async () => {
    const storage = new TestStorage();
    const { windowRef, replacements } = createWindow(storage);
    const latest = createManifest('0830_0521-fedcba9', '0830_0521');
    const createManager = () => new WebReleaseManager({
        windowRef,
        documentRef: createDocument('0830_0520-abcdef1', '0830_0520'),
        now: () => 5678,
        fetchImpl: async () => ({ ok: true, json: async () => latest })
    });

    const first = await createManager().ensureLatest();
    assert.equal(first.reloadScheduled, true);
    assert.equal(replacements.length, 1);
    const replacement = new URL(replacements[0]);
    assert.equal(replacement.searchParams.get('release'), latest.id);
    assert.equal(replacement.searchParams.get('refresh'), '5678');
    assert.equal(replacement.searchParams.get('hpbar'), 'top');

    const second = await createManager().ensureLatest();
    assert.equal(second.reloadScheduled, false);
    assert.equal(replacements.length, 1);
});

test('release.json 조회가 실패하면 내장 버전으로 안전하게 실행한다', async () => {
    const { windowRef } = createWindow();
    const manager = new WebReleaseManager({
        windowRef,
        documentRef: createDocument('0830_0520-abcdef1', '0830_0520'),
        fetchImpl: async () => {
            throw new Error('offline');
        }
    });

    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        const state = await manager.ensureLatest();
        assert.equal(state.reloadScheduled, false);
        assert.equal(state.releaseInfo.id, '0830_0520-abcdef1');
        assert.equal(state.releaseInfo.version, '0830_0520');
    } finally {
        console.warn = originalWarn;
    }
});

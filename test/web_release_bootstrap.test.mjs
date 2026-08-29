import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const BOOTSTRAP_SOURCE = await readFile(
    new URL('../project/engine/release-bootstrap.js', import.meta.url),
    'utf8'
);

/** @param {string} currentId @param {object} latest @returns {Promise<object>} */
async function runBootstrap(currentId, latest) {
    const appendedScripts = [];
    const replacements = [];
    const storage = new Map();
    const documentRef = {
        baseURI: 'https://jukchang.com/game/nthplayer/',
        currentScript: {
            dataset: {
                mainSrc: './releases/current/script/main.js',
                nwSetupSrc: './releases/current/script/nw-setup.js'
            }
        },
        querySelector() {
            return { content: currentId };
        },
        createElement() {
            return {};
        },
        body: {
            appendChild(script) {
                appendedScripts.push({ type: script.type, src: script.src });
            }
        }
    };
    const windowRef = {};
    runInNewContext(BOOTSTRAP_SOURCE, {
        URL,
        Date,
        console: { warn() {} },
        document: documentRef,
        fetch: async () => ({ ok: true, json: async () => latest }),
        location: {
            protocol: 'https:',
            href: 'https://jukchang.com/game/nthplayer/?quality=high',
            replace(url) {
                replacements.push(url);
            }
        },
        sessionStorage: {
            getItem(key) {
                return storage.get(key) || null;
            },
            setItem(key, value) {
                storage.set(key, String(value));
            },
            removeItem(key) {
                storage.delete(key);
            }
        },
        window: windowRef
    });
    await new Promise((resolve) => setImmediate(resolve));
    return { appendedScripts, replacements, windowRef };
}

test('릴리스 bootstrap은 최신 매니페스트를 확인한 뒤에만 엔진 모듈을 연결한다', async () => {
    const latest = {
        id: '0830_0520-abcdef1',
        version: '0830_0520',
        changelog: []
    };
    const state = await runBootstrap(latest.id, latest);

    assert.deepEqual(state.replacements, []);
    assert.deepEqual(state.appendedScripts, [
        { type: 'module', src: './releases/current/script/main.js' },
        { type: 'module', src: './releases/current/script/nw-setup.js' }
    ]);
    assert.equal(state.windowRef.__NTHPLAYER_RELEASE_MANIFEST__, latest);
});

test('릴리스 bootstrap은 구버전 문서에서 모듈 요청 전에 최신 문서로 재접속한다', async () => {
    const latest = {
        id: '0830_0521-fedcba9',
        version: '0830_0521',
        changelog: []
    };
    const state = await runBootstrap('0830_0520-abcdef1', latest);

    assert.deepEqual(state.appendedScripts, []);
    assert.equal(state.replacements.length, 1);
    const replacement = new URL(state.replacements[0]);
    assert.equal(replacement.searchParams.get('release'), latest.id);
    assert.equal(replacement.searchParams.get('quality'), 'high');
    assert.ok(replacement.searchParams.has('refresh'));
});

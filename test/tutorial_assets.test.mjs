import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { TUTORIAL_ASSET_MANIFEST } from '../project/engine/script/data/game/tutorial_asset_manifest.js';
import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { renderDrawImage } from '../project/engine/script/display/draw_2d_image.js';
import { TutorialAssetLoader } from '../project/engine/script/scene/tutorial/_tutorial_asset_loader.js';
import { TutorialAssetPort } from '../project/engine/script/scene/tutorial/_tutorial_asset_port.js';
import { TutorialAchievementBanner } from '../project/engine/script/scene/tutorial/_tutorial_achievement_banner.js';
import { TutorialBattleLayout } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_layout.js';
import {
    fitTutorialAssetRect,
    resolveTutorialAssetRect
} from '../project/engine/script/scene/tutorial/view/_tutorial_asset_view_helpers.js';
import { auditTutorialAssets } from '../scripts/tutorial-assets/tutorial_asset_audit.mjs';
import { resolveTutorialAssetPaths } from '../scripts/tutorial-assets/tutorial_asset_paths.mjs';

const TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(TEST_DIRECTORY, '..');

test('에셋 매니페스트는 유일 ID, 안전한 런타임 경로와 명시적 폴백을 고정한다', () => {
    assert.equal(Object.isFrozen(TUTORIAL_ASSET_MANIFEST), true);
    assert.equal(Object.isFrozen(TUTORIAL_ASSET_MANIFEST.ENTRIES), true);
    const ids = TUTORIAL_ASSET_MANIFEST.ENTRIES.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const entry of TUTORIAL_ASSET_MANIFEST.ENTRIES) {
        assert.equal(Object.isFrozen(entry), true, entry.id);
        assert.equal(typeof entry.layer, 'string', entry.id);
        assert.equal(typeof entry.usage, 'string', entry.id);
        assert.equal(typeof entry.required, 'boolean', entry.id);
        if (entry.type === 'image/png') {
            assert.match(entry.runtimePath, /^\.\.\/asset\/tutorial\/[a-z0-9./-]+\.png$/);
            assert.equal(Number.isInteger(entry.expectedDimensions.width), true, entry.id);
            assert.equal(Number.isInteger(entry.expectedDimensions.height), true, entry.id);
        } else {
            assert.equal(entry.id, 'item.tile-cleanser');
            assert.equal(entry.required, false);
        }
        if (entry.fallback) {
            assert.equal(ids.includes(entry.fallback), true, entry.id);
        }
    }
    assert.equal(TUTORIAL_ASSET_MANIFEST.ITEMS['tile-cleanser'], 'item.tile-cleanser');
    assert.deepEqual(Object.keys(TUTORIAL_ASSET_MANIFEST.MAPS), [
        'first-floor',
        'basement'
    ]);
});

test('원본과 안전 복사본은 매니페스트의 PNG 헤더 크기 계약을 모두 만족한다', async () => {
    const audit = await auditTutorialAssets({
        manifest: TUTORIAL_ASSET_MANIFEST,
        repositoryRoot: REPOSITORY_ROOT,
        checkRuntime: true
    });
    assert.deepEqual(audit.errors, []);
    assert.deepEqual(audit.warnings, []);
    assert.equal(
        audit.entries.filter((entry) => entry.status === 'ready').length,
        TUTORIAL_ASSET_MANIFEST.ENTRIES.filter((entry) => entry.type === 'image/png').length
    );
    assert.equal(
        audit.entries.filter((entry) => entry.status === 'generated-fallback').length,
        TUTORIAL_ASSET_MANIFEST.ENTRIES.filter(
            (entry) => entry.type === 'generated-fallback'
        ).length
    );
});

test('에셋 경로 계산은 원본·런타임 루트 밖으로 나가는 입력을 거부한다', () => {
    const manifest = {
        SOURCE_ROOT: 'project/asset',
        RUNTIME_ROOT: 'project/asset/tutorial'
    };
    assert.throws(() => resolveTutorialAssetPaths(manifest, {
        id: 'source-escape',
        sourceName: '../secret.png',
        runtimePath: '../asset/tutorial/safe.png'
    }, REPOSITORY_ROOT), /SOURCE_ROOT 밖/);
    assert.throws(() => resolveTutorialAssetPaths(manifest, {
        id: 'runtime-escape',
        sourceName: 'img/map/map_floor1_full.png',
        runtimePath: '../../outside.png'
    }, REPOSITORY_ROOT), /RUNTIME_ROOT 밖/);
});

test('에셋 로더는 크롭을 nearest로 만들고 실패한 논리 ID는 fallback을 따른다', () => {
    const images = [];
    class FakeImage {
        constructor() {
            this.complete = false;
            this.naturalWidth = 0;
            this.naturalHeight = 0;
            this.onload = null;
            this.onerror = null;
            images.push(this);
        }

        set src(value) {
            this.source = value;
        }

        succeed(width, height) {
            this.complete = true;
            this.naturalWidth = width;
            this.naturalHeight = height;
            this.onload?.();
        }

        fail() {
            this.onerror?.();
        }
    }
    const cropCalls = [];
    const canvases = [];
    const canvasFactory = () => {
        const context = {
            imageSmoothingEnabled: true,
            clearRect() {},
            drawImage(...args) {
                cropCalls.push({ smoothing: this.imageSmoothingEnabled, args });
            }
        };
        const canvas = {
            width: 0,
            height: 0,
            getContext: () => context
        };
        canvases.push(canvas);
        return canvas;
    };
    const loader = new TutorialAssetLoader({
        imageFactory: () => new FakeImage(),
        canvasFactory
    });
    loader.loadManifest({
        ENTRIES: [
            {
                id: 'crop', type: 'image/png', runtimePath: 'crop.png',
                expectedDimensions: { width: 4, height: 2 },
                sourceRect: { x: 1, y: 0, w: 2, h: 2 }, fallback: null
            },
            {
                id: 'primary', type: 'image/png', runtimePath: 'primary.png',
                expectedDimensions: { width: 4, height: 2 },
                sourceRect: null, fallback: 'fallback'
            },
            {
                id: 'fallback', type: 'image/png', runtimePath: 'fallback.png',
                expectedDimensions: { width: 4, height: 2 },
                sourceRect: null, fallback: null
            },
            { id: 'generated', type: 'generated-fallback', runtimePath: null }
        ]
    });
    images[0].succeed(4, 2);
    images[1].fail();
    images[2].succeed(4, 2);

    assert.equal(loader.getOwnImage('crop'), canvases[0]);
    assert.equal(canvases[0].width, 2);
    assert.equal(canvases[0].height, 2);
    assert.equal(cropCalls[0].smoothing, false);
    assert.deepEqual(cropCalls[0].args.slice(1), [1, 0, 2, 2, 0, 0, 2, 2]);
    assert.equal(loader.getStatus('primary'), 'failed');
    assert.equal(loader.getImage('primary'), images[2]);
    assert.equal(loader.getStatus('generated'), 'unavailable');
    loader.destroy();
});

test('에셋 포트는 분리 맵을 우선하고 불완전하면 합성본으로 폴백한다', () => {
    const ready = new Map();
    const loader = {
        getOwnImage(id) { return ready.get(id) || null; },
        getImage(id) { return ready.get(id) || null; },
        isOwnReady(id) { return ready.has(id); },
        loadManifest() { return []; },
        getSnapshot() { return {}; }
    };
    const port = new TutorialAssetPort(loader, TUTORIAL_ASSET_MANIFEST);
    const profile = TUTORIAL_ASSET_MANIFEST.MAPS['first-floor'];
    const background = { width: 970, height: 580 };
    const grid = { width: 970, height: 580 };
    const full = { width: 970, height: 580 };
    ready.set(profile.backgroundId, background);
    ready.set(profile.fullId, full);
    assert.equal(port.getMapArtwork('first-floor').mode, 'full');
    ready.set(profile.gridId, grid);
    assert.deepEqual(port.getMapArtwork('first-floor'), {
        mode: 'separated',
        layers: [background, grid]
    });
});

test('업적 배너는 판정된 알림을 같은 키로 한 런에서 한 번만 순서대로 표시한다', () => {
    const banner = new TutorialAchievementBanner({ durationSeconds: 1 });
    banner.enqueue([
        { key: 'achievement:mirror', title: '업적 달성', detail: '거울 발견' },
        { key: 'achievement:mirror', title: '업적 달성', detail: '중복 알림' },
        { key: 'achievement:mushroom', title: '업적 달성', detail: '버섯 발견' }
    ]);
    assert.deepEqual(banner.getSnapshot(), {
        visible: true,
        title: '업적 달성',
        detail: '거울 발견',
        progress: 0
    });
    banner.update(1);
    assert.equal(banner.getSnapshot().detail, '버섯 발견');
    banner.update(1);
    assert.equal(banner.getSnapshot().visible, false);
});

test('두 원본 맵의 9×8 타일 중심은 모든 칸에서 같은 히트테스트 좌표로 돌아온다', () => {
    const layout = new TutorialBattleLayout({
        map: TUTORIAL_GAME_DATA.MAP,
        floors: TUTORIAL_GAME_DATA.FLOORS,
        mapArtwork: TUTORIAL_ASSET_MANIFEST.MAPS,
        board: TUTORIAL_GAME_DATA.LAYOUT.BOARD,
        hud: TUTORIAL_GAME_DATA.LAYOUT.HUD,
        shakeTileRatio: TUTORIAL_GAME_DATA.ANIMATION.SHAKE_TILE_RATIO
    });
    layout.resize({ WW: 1600, WH: 720, UIWW: 1280, UIOffsetX: 160 });
    for (const floor of TUTORIAL_GAME_DATA.FLOORS) {
        const frame = layout.createFrame({ floor });
        assert.ok(frame.mapImageRect);
        assert.ok(Math.abs((frame.mapImageRect.w / frame.mapImageRect.h) - (970 / 580)) < 0.01);
        for (let y = 0; y < TUTORIAL_GAME_DATA.MAP.HEIGHT; y++) {
            for (let x = 0; x < TUTORIAL_GAME_DATA.MAP.WIDTH; x++) {
                const point = TutorialBattleLayout.projectTile(frame, x, y);
                assert.deepEqual(
                    TutorialBattleLayout.hitTestTile(frame, point.x, point.y),
                    { x, y },
                    `${floor.id} (${x}, ${y})`
                );
            }
        }
        const middle = TutorialBattleLayout.projectTile(frame, 4, 3);
        assert.deepEqual(TutorialBattleLayout.hitTestTile(
            frame,
            middle.x + (frame.gridAxisX.x * 0.45) + (frame.gridAxisY.x * 0.45),
            middle.y + (frame.gridAxisX.y * 0.45) + (frame.gridAxisY.y * 0.45)
        ), { x: 4, y: 3 }, `${floor.id} 기울어진 타일 내부 판정`);
    }
});

test('픽셀 UI는 비율을 유지한 정수 사각형과 일시적 nearest 옵션을 사용한다', () => {
    const fitted = fitTutorialAssetRect(
        { width: 153, height: 26 },
        { x: 10.4, y: 20.7, w: 300, h: 60 }
    );
    assert.deepEqual(fitted, { x: 10, y: 25, w: 300, h: 51 });
    assert.ok(Math.abs((fitted.w / fitted.h) - (153 / 26)) < 0.02);
    assert.deepEqual(resolveTutorialAssetRect(
        { width: 153, height: 26 },
        { x: 10.4, y: 20.7, w: 300, h: 60 },
        'exact'
    ), { x: 10, y: 21, w: 300, h: 60 });

    const smoothingChanges = [];
    const context = {
        _smoothing: true,
        get imageSmoothingEnabled() { return this._smoothing; },
        set imageSmoothingEnabled(value) {
            this._smoothing = value;
            smoothingChanges.push(value);
        },
        drawImage() {
            assert.equal(this.imageSmoothingEnabled, false);
        }
    };
    renderDrawImage(context, {
        image: {}, x: 0, y: 0, w: 16, h: 16, smoothing: false
    });
    assert.deepEqual(smoothingChanges, [false, true]);

    const transformCalls = [];
    const flippedContext = {
        imageSmoothingEnabled: true,
        save() { transformCalls.push(['save']); },
        translate(...args) { transformCalls.push(['translate', ...args]); },
        scale(...args) { transformCalls.push(['scale', ...args]); },
        drawImage(...args) { transformCalls.push(['drawImage', ...args]); },
        restore() { transformCalls.push(['restore']); }
    };
    renderDrawImage(flippedContext, {
        image: 'arrow', x: 10, y: 20, w: 19, h: 32,
        smoothing: false, flipX: true
    });
    assert.deepEqual(transformCalls, [
        ['save'],
        ['translate', 29, 20],
        ['scale', -1, 1],
        ['drawImage', 'arrow', 0, 0, 19, 32],
        ['restore']
    ]);

    const throwingContext = {
        imageSmoothingEnabled: true,
        drawImage() { throw new Error('draw failed'); }
    };
    assert.throws(() => renderDrawImage(throwingContext, {
        image: {}, x: 0, y: 0, w: 16, h: 16, smoothing: false
    }), /draw failed/);
    assert.equal(throwingContext.imageSmoothingEnabled, true);
});

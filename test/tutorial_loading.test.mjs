import assert from 'node:assert/strict';
import test from 'node:test';

import { TutorialAssetLoader } from '../project/engine/script/scene/tutorial/_tutorial_asset_loader.js';
import { TutorialLoadingCoordinator } from '../project/engine/script/scene/tutorial/_tutorial_loading_coordinator.js';
import { TutorialNonbattleViewModelFactory } from '../project/engine/script/scene/tutorial/_tutorial_nonbattle_view_model_factory.js';
import { TutorialLoadingView } from '../project/engine/script/scene/tutorial/view/_tutorial_loading_view.js';
import { isTutorialRectWithinUi } from '../project/engine/script/scene/tutorial/view/_tutorial_nonbattle_view_helpers.js';

test('에셋 로더 진행도는 성공·실패·생성형 폴백을 모두 완료 작업으로 센다', () => {
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

    const loader = new TutorialAssetLoader({
        imageFactory: () => new FakeImage()
    });
    loader.loadManifest({
        ENTRIES: [
            {
                id: 'ready', type: 'image/png', runtimePath: 'ready.png',
                expectedDimensions: { width: 4, height: 2 }
            },
            {
                id: 'failed', type: 'image/png', runtimePath: 'failed.png',
                expectedDimensions: { width: 4, height: 2 }
            },
            { id: 'generated', type: 'generated-fallback', runtimePath: null }
        ]
    });

    assert.deepEqual(loader.getProgress(), {
        completed: 1,
        total: 3,
        pending: 2,
        ratio: 1 / 3,
        percent: 33
    });
    images[0].succeed(4, 2);
    images[1].fail();
    assert.deepEqual(loader.getProgress(), {
        completed: 3,
        total: 3,
        pending: 0,
        ratio: 1,
        percent: 100
    });
    loader.destroy();
});

test('로딩 조정자는 저장 데이터와 에셋이 모두 끝난 뒤 완료를 한 번만 알린다', () => {
    let assetProgress = { completed: 0, total: 2 };
    const completedMeta = [];
    const coordinator = new TutorialLoadingCoordinator({
        assetPort: {
            getLoadProgress() {
                return assetProgress;
            }
        },
        onReady(meta) {
            completedMeta.push(meta);
        }
    });
    const meta = { playCount: 3 };

    assert.deepEqual(coordinator.getSnapshot(), {
        completed: 0,
        total: 3,
        pending: 3,
        ratio: 0,
        percent: 0,
        assetCompleted: 0,
        assetTotal: 2,
        metaCompleted: 0
    });
    coordinator.resolveMeta(meta);
    assert.equal(coordinator.getSnapshot().percent, 33);
    assert.deepEqual(completedMeta, []);

    assetProgress = { completed: 1, total: 2 };
    coordinator.refresh();
    assert.equal(coordinator.getSnapshot().percent, 67);
    assert.deepEqual(completedMeta, []);

    assetProgress = { completed: 2, total: 2 };
    coordinator.refresh();
    coordinator.refresh();
    assert.deepEqual(completedMeta, [meta]);
    assert.equal(coordinator.getSnapshot().percent, 100);
    coordinator.destroy();
});

test('로딩 뷰는 실제 퍼센트와 픽셀 바를 UI 영역 안에 그린다', () => {
    const viewport = Object.freeze({
        WW: 1600,
        WH: 720,
        UIWW: 1280,
        UIOffsetX: 160
    });
    const frame = Object.freeze({
        viewport,
        fonts: Object.freeze({
            HEADING: '700 28px sans-serif',
            SMALL: '500 16px sans-serif'
        }),
        colors: Object.freeze({
            UI: Object.freeze({
                Text: '#ffffff',
                Muted: '#9a9a9a',
                PanelStrong: '#111111',
                Accent: '#55ddff',
                ButtonShadow: 'rgba(0, 0, 0, 0.4)'
            })
        })
    });
    const factory = new TutorialNonbattleViewModelFactory({});
    const viewModel = factory.createLoading(frame, { completed: 3, total: 4 });
    const commands = [];
    const view = new TutorialLoadingView({
        render(layer, command) {
            commands.push({ layer, command });
        },
        renderGL() {},
        wrapText(text) {
            return [String(text)];
        }
    });

    assert.equal(viewModel.progressRatio, 0.75);
    assert.equal(viewModel.progressPercent, 75);
    const layout = view.getLayout(viewModel);
    for (const rect of layout.contentRects) {
        assert.equal(isTutorialRectWithinUi(rect, viewport), true);
    }

    view.draw(viewModel);
    assert.equal(commands.every(({ layer }) => layer === 'ui'), true);
    assert.ok(commands.some(({ command }) => command.text === '75%'));
    assert.ok(commands.some(({ command }) => (
        command.text === '게임 데이터 불러오는 중…'
    )));
    const fill = commands.find(({ command }) => (
        command.shape === 'rect'
        && command.fill === frame.colors.UI.Accent
    ))?.command;
    assert.ok(fill);
    assert.ok(fill.w > layout.bar.w * 0.7);
    assert.ok(fill.w < layout.bar.w * 0.8);
});

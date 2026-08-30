import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { EFFECT_RENDER_CONSTANTS } from '../project/engine/script/data/display/effect_render_constants.js';
import { TUTORIAL_CONTENT_DATA } from '../project/engine/script/data/game/tutorial_content_data.js';
import { TUTORIAL_GALLERY_PRESENTATION_DATA } from '../project/engine/script/data/game/tutorial_gallery_presentation_data.js';
import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TutorialGalleryNavigationController } from '../project/engine/script/scene/tutorial/_tutorial_gallery_navigation_controller.js';
import { TutorialGalleryPageTurnController } from '../project/engine/script/scene/tutorial/_tutorial_gallery_page_turn_controller.js';
import { TutorialGalleryPageTurnSurface } from '../project/engine/script/scene/tutorial/_tutorial_gallery_page_turn_surface.js';
import { TutorialGalleryPageTurnView } from '../project/engine/script/scene/tutorial/view/_tutorial_gallery_page_turn_view.js';

/** @returns {object} 완료 시점을 직접 제어하는 애니메이션 대역입니다. */
function createAnimationHarness() {
    const animations = [];
    return {
        animations,
        port: {
            animate(owner, spec) {
                let resolve = () => {};
                const animation = {
                    id: animations.length,
                    owner,
                    spec,
                    promise: new Promise((done) => { resolve = done; }),
                    finish() {
                        owner[spec.variable] = spec.endValue;
                        resolve();
                    }
                };
                owner[spec.variable] = spec.startValue;
                animations.push(animation);
                return { id: animation.id, promise: animation.promise };
            },
            remove(id) {
                animations[id]?.finish();
            }
        }
    };
}

/** @returns {Promise<void>} 완료 프로미스 후속 작업까지 비웁니다. */
async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
}

test('갤러리 페이지 전환은 기존 0.24초 선택 연출보다 정확히 두 배 느리다', () => {
    assert.equal(TUTORIAL_GAME_DATA.ANIMATION.SELECTION_SECONDS, 0.24);
    assert.equal(TUTORIAL_GALLERY_PRESENTATION_DATA.PAGE_TURN_SECONDS, 0.48);
    assert.equal(
        TUTORIAL_GALLERY_PRESENTATION_DATA.PAGE_TURN_SECONDS,
        TUTORIAL_GAME_DATA.ANIMATION.SELECTION_SECONDS * 2
    );
});

test('페이지 전환 컨트롤러는 이전 UI 캡처와 0.48초 진행도를 같은 수명으로 관리한다', async () => {
    const harness = createAnimationHarness();
    const calls = [];
    const surface = {
        capture(layer) {
            calls.push(['capture', layer]);
            return true;
        },
        submit(command) {
            calls.push(['submit', command]);
            return true;
        },
        clear() {
            calls.push(['clear']);
        },
        destroy() {
            calls.push(['destroy']);
        }
    };
    const controller = new TutorialGalleryPageTurnController({
        animationPort: harness.port,
        surfacePort: surface,
        config: TUTORIAL_GALLERY_PRESENTATION_DATA
    });
    const previousGallery = Object.freeze({ selectedIndex: 0 });

    assert.equal(controller.start({ previousGallery, direction: 1 }), true);
    assert.deepEqual(calls.slice(0, 2), [['clear'], ['capture', 'ui']]);
    assert.equal(harness.animations[0].spec.duration, 0.48);
    assert.equal(harness.animations[0].spec.type, 'easeInOutCubic');
    harness.animations[0].owner.progress = 0.35;
    assert.deepEqual(controller.getSnapshot(), {
        active: true,
        progress: 0.35,
        direction: 1,
        previousGallery,
        webglAvailable: true,
        revision: 1
    });
    assert.equal(controller.renderPageTurn({ shape: 'pageTurn' }), true);
    assert.equal(calls.at(-1)[0], 'submit');

    harness.animations[0].finish();
    await flushPromises();
    assert.equal(controller.getSnapshot().active, false);
    assert.equal(controller.getSnapshot().progress, 1);
    controller.destroy();
    assert.equal(calls.at(-1)[0], 'destroy');
});

test('갤러리 탐색은 선택을 먼저 바꾸고 이전 페이지 스냅샷으로 전환을 시작한다', () => {
    const harness = createAnimationHarness();
    const captures = [];
    const navigation = new TutorialGalleryNavigationController({
        content: TUTORIAL_CONTENT_DATA,
        cutscenes: TUTORIAL_GAME_DATA.CUTSCENES,
        animationPort: harness.port,
        surfacePort: {
            capture(layer) {
                captures.push(layer);
                return true;
            },
            clear() {},
            destroy() {}
        },
        config: TUTORIAL_GALLERY_PRESENTATION_DATA,
        getMode: () => 'gallery',
        getMeta: () => ({}),
        isCutsceneOpen: () => false
    });
    const before = navigation.getSnapshot();

    assert.equal(navigation.shiftEntry({ delta: 1 }), true);
    assert.equal(navigation.getSnapshot().selectedIndex, 1);
    assert.deepEqual(navigation.getPageTurnSnapshot().previousGallery, before);
    assert.deepEqual(captures, ['ui']);
    assert.equal(navigation.shiftEntry({ delta: 1 }), false);
    navigation.destroy();
});

test('페이지 전환 뷰는 중간점에서 내용을 교체하고 방향별 실제 페이지 영역을 제출한다', () => {
    const commands = [];
    const view = new TutorialGalleryPageTurnView({
        renderPageTurn(command) {
            commands.push(command);
            return true;
        }
    }, TUTORIAL_GALLERY_PRESENTATION_DATA);
    const previousGallery = {
        selectedSectionId: 'cutscenes',
        selectedIndex: 0,
        selectedEntry: { id: 'old' },
        entries: [{ id: 'old' }],
        sections: []
    };
    const base = {
        selectedSectionId: 'endings',
        selectedIndex: 1,
        selectedEntry: { id: 'new' },
        entries: [{ id: 'new' }],
        sections: [],
        pageTurn: {
            active: true,
            progress: 0.35,
            direction: 1,
            previousGallery,
            webglAvailable: true
        }
    };
    const layout = {
        leftPage: { x: 10, y: 20, w: 100, h: 180 },
        rightPage: { x: 120, y: 20, w: 100, h: 180 }
    };

    const early = view.createPresentation(base);
    assert.equal(early.contentViewModel.selectedEntry.id, 'old');
    assert.equal(early.frameKey, 'endingBook1');
    view.draw(base, layout);
    assert.deepEqual(commands[0].pageRect, layout.rightPage);
    assert.equal(commands[0].shape, EFFECT_RENDER_CONSTANTS.TYPES.PAGE_TURN);

    const late = view.createPresentation({
        ...base,
        pageTurn: { ...base.pageTurn, progress: 0.65 }
    });
    assert.equal(late.contentViewModel.selectedEntry.id, 'new');
    const fallback = view.createPresentation({
        ...base,
        pageTurn: {
            ...base.pageTurn,
            progress: 0.5,
            direction: -1,
            webglAvailable: false
        }
    });
    assert.equal(fallback.frameKey, 'endingBook3');
    assert.equal(fallback.flipBookFrame, true);
});

test('페이지 surface는 UI canvas를 복제해 동적 WebGL 명령의 텍스처로 전달한다', () => {
    const drawCalls = [];
    const renderCalls = [];
    const released = [];
    const snapshotContext = {
        clearRect() {},
        drawImage(...args) {
            drawCalls.push(args);
        }
    };
    const documentRef = {
        createElement() {
            return {
                width: 0,
                height: 0,
                getContext: () => snapshotContext
            };
        }
    };
    const source = { width: 1280, height: 720, ownerDocument: documentRef };
    const surfaceCanvas = { addEventListener() {}, removeEventListener() {} };
    const surface = new TutorialGalleryPageTurnSurface({
        displaySystem: {
            createDynamicSurface: () => ({
                id: 'dynamic:webgl:test',
                context: {},
                canvas: surfaceCanvas
            }),
            getSurface: () => ({ canvas: source }),
            releaseDynamicSurface: (id) => released.push(id)
        },
        renderGL(layer, command) {
            renderCalls.push({ layer, command });
        },
        config: TUTORIAL_GALLERY_PRESENTATION_DATA,
        documentRef
    });

    assert.equal(surface.capture('ui'), true);
    assert.equal(drawCalls.length, 1);
    assert.equal(surface.submit({ shape: 'pageTurn' }), true);
    assert.equal(renderCalls[0].layer, 'dynamic:webgl:test');
    assert.equal(renderCalls[0].command.image.width, 1280);
    surface.destroy();
    assert.deepEqual(released, ['dynamic:webgl:test']);
});

test('WebGL pageTurn pass는 캡처 텍스처·3D 원근·곡률·낙하 그림자를 함께 사용한다', async () => {
    const [passSource, registrySource] = await Promise.all([
        readFile(new URL(
            '../project/engine/script/display/webgl/_page_turn_effect_pass.js',
            import.meta.url
        ), 'utf8'),
        readFile(new URL(
            '../project/engine/script/display/webgl/_effect_pass_registry.js',
            import.meta.url
        ), 'utf8')
    ]);
    assert.equal(EFFECT_RENDER_CONSTANTS.TYPES.PAGE_TURN, 'pageTurn');
    assert.match(passSource, /uniform sampler2D u_pageTexture/);
    assert.match(passSource, /perspectiveScale/);
    assert.match(passSource, /u_curlStrength/);
    assert.match(passSource, /u_shadowAlpha/);
    assert.match(passSource, /gl\.drawElements\(gl\.TRIANGLES/);
    assert.match(registrySource, /new PageTurnEffectPass\(gl\)/);
});

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
import { TutorialGalleryView } from '../project/engine/script/scene/tutorial/view/_tutorial_gallery_view.js';
import { PAGE_VERTEX_SHADER, PAGE_FRAGMENT_SHADER, SPREAD_FRAGMENT_SHADER } from '../project/engine/script/display/webgl/_page_turn_effect_shaders.js';

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

test('갤러리 페이지 전환은 공통 선택 연출과 분리된 0.7초다', () => {
    assert.equal(TUTORIAL_GAME_DATA.ANIMATION.SELECTION_SECONDS, 0.24);
    assert.equal(TUTORIAL_GALLERY_PRESENTATION_DATA.PAGE_TURN_SECONDS, 0.7);
});

test('페이지 전환은 UI가 지워진 입력 단계에서 캡처하지 않고 0.7초 동안 draw 포트를 사용한다', async () => {
    const harness = createAnimationHarness();
    const calls = [];
    const surface = {
        capture(layer) {
            calls.push(['capture', layer]);
            return true;
        },
        submit(command, frames) {
            calls.push(['submit', command, frames]);
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
    assert.deepEqual(calls, [['clear']], 'frame.clear 직후의 빈 UI를 캡처하면 안 됩니다.');
    assert.equal(harness.animations[0].spec.duration, 0.7);
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
    const frames = { previous() {}, next() {} };
    assert.equal(controller.renderPageTurn({ shape: 'pageTurn' }, frames), true);
    assert.equal(calls.at(-1)[0], 'submit');
    assert.equal(calls.at(-1)[2], frames);

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
    assert.deepEqual(captures, []);
    assert.equal(navigation.shiftEntry({ delta: 1 }), false);
    navigation.destroy();
});

test('페이지 전환 뷰는 이전·다음 내용을 양면에 연결하고 두 페이지가 같은 책등에 착지한다', () => {
    const commands = [];
    const painted = [];
    const view = new TutorialGalleryPageTurnView({
        renderPageTurn(command, frames) {
            commands.push(command);
            frames.previous({});
            frames.next({});
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
        viewport: { WW: 1280, WH: 720 },
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

    assert.equal(view.draw(base, layout, (model) => painted.push(model.selectedEntry.id)), true);
    assert.deepEqual(painted, ['old', 'new']);
    assert.deepEqual(commands[0].pageRect, { x: 115, y: 20, w: 105, h: 180 });
    assert.deepEqual(commands[0].backPageRect, { x: 10, y: 20, w: 105, h: 180 });
    assert.equal(commands[0].shape, EFFECT_RENDER_CONSTANTS.TYPES.PAGE_TURN);
    view.draw({
        ...base,
        pageTurn: { ...base.pageTurn, progress: 0, direction: -1 }
    }, layout, () => {});
    assert.deepEqual(commands[1].pageRect, commands[0].backPageRect);
    assert.deepEqual(commands[1].backPageRect, commands[0].pageRect);
    assert.equal(commands[1].progress, 0, '첫 프레임부터 실제 콘텐츠를 덮어야 합니다.');
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

test('페이지 surface는 빈 화면을 복사하지 않고 실제 콘텐츠를 두 번만 래스터화한다', () => {
    const renderCalls = [];
    const released = [];
    const canvases = [];
    const registered = [];
    const contexts = new Map();
    let contextLost = null;
    const documentRef = {
        createElement() {
            const canvas = { width: 0, height: 0, commands: [] };
            canvas.getContext = () => ({ canvas });
            canvases.push(canvas);
            return canvas;
        }
    };
    const source = {
        width: 2560, height: 1440, ownerDocument: documentRef,
        getContext() { throw new Error('지워진 화면 UI를 읽으면 안 됩니다.'); }
    };
    const surface = new TutorialGalleryPageTurnSurface({
        displaySystem: {
            createDynamicSurface: () => ({
                id: 'dynamic:webgl:test',
                context: { MAX_TEXTURE_SIZE: 1, getParameter: () => 2048 },
                canvas: {
                    addEventListener(_name, listener) { contextLost = listener; },
                    removeEventListener() {}
                }
            }),
            drawHandler: {
                registerLayer(layer, context, options) {
                    contexts.set(layer, context);
                    registered.push(options);
                },
                unregisterLayer(layer) { contexts.delete(layer); },
                render(layer, command) { contexts.get(layer).canvas.commands.push(command); },
                measureText: (value) => String(value).length * 8
            },
            getSurface: () => ({ canvas: source }),
            releaseDynamicSurface: (id) => released.push(id)
        },
        renderGL(layer, command) { renderCalls.push({ layer, command }); },
        config: TUTORIAL_GALLERY_PRESENTATION_DATA,
        documentRef
    });
    const frames = {
        viewport: { WW: 1280, WH: 720 },
        previous(port) {
            port.render('ui', { shape: 'image', image: '이전 책' });
            port.render('ui', { shape: 'text', text: '이전 실제 내용' });
        },
        next(port) {
            port.render('ui', { shape: 'image', image: '다음 책' });
            port.render('ui', { shape: 'text', text: '다음 실제 내용' });
        }
    };

    assert.equal(surface.submit({ shape: 'pageTurn' }, frames), true);
    assert.equal(renderCalls[0].layer, 'dynamic:webgl:test');
    assert.equal(renderCalls[0].command.image.width, 2048);
    assert.equal(renderCalls[0].command.image.height, 1152);
    assert.equal(registered[0].transformScaleX, 1.6);
    assert.deepEqual(renderCalls[0].command.image.commands.map((c) => c.text || c.image),
        ['이전 책', '이전 실제 내용']);
    assert.deepEqual(renderCalls[0].command.backImage.commands.map((c) => c.text || c.image),
        ['다음 책', '다음 실제 내용']);
    assert.equal(contexts.size, 0, '임시 2D 레이어는 래스터화 직후 등록을 해제해야 합니다.');
    assert.equal(surface.submit({ shape: 'pageTurn', progress: 0.7 }, frames), true);
    assert.equal(canvases.length, 2, '진행도 갱신마다 전체 화면을 다시 캡처하면 안 됩니다.');
    assert.equal(renderCalls[0].command.image, renderCalls[1].command.image);
    assert.equal(surface.submit({ shape: 'pageTurn' }, {
        ...frames, viewport: { WW: 1600, WH: 900 }
    }), true);
    assert.equal(canvases.length, 4, '뷰포트 변경 시 두 콘텐츠를 새 좌표로 다시 그립니다.');
    contextLost({ preventDefault() {} });
    assert.equal(surface.submit({ shape: 'pageTurn' }, frames), false);
    surface.destroy();
    assert.deepEqual(released, ['dynamic:webgl:test']);
});

test('갤러리 본문·그림은 WebGL 텍스처에만 그려지고 고정 2D 본문을 중복하지 않는다', () => {
    const screenCommands = [];
    const snapshots = [];
    let accepted = true;
    const pageTurnView = new TutorialGalleryPageTurnView({
        renderPageTurn(_command, frames) {
            if (!accepted) {
                return false;
            }
            for (const draw of [frames.previous, frames.next]) {
                const commands = [];
                draw({
                    render: (_layer, command) => commands.push(command),
                    measureText: (value) => String(value).length * 8
                });
                snapshots.push(commands);
            }
            return true;
        }
    }, TUTORIAL_GALLERY_PRESENTATION_DATA);
    const asset = { width: 1024, height: 640 };
    const gallery = new TutorialGalleryView({
        render: (_layer, command) => screenCommands.push(command),
        measureText: (value) => String(value).length * 8,
        wrapText: (value) => [String(value)]
    }, { getUiAsset: () => asset }, { pageTurnView });
    const oldEntry = { id: 'old', title: '이전 실제 제목', body: '이전 본문', unlocked: true };
    const nextEntry = { id: 'next', title: '다음 실제 제목', body: '다음 본문', unlocked: true };
    const viewModel = {
        viewport: { WW: 1280, WH: 720, UIWW: 1280, UIOffsetX: 0 },
        fonts: { SMALL: '16px sans-serif' },
        colors: { UI: { PanelStrong: '#321', Text: '#fff', Muted: '#987' } },
        selectedSectionId: 'cutscenes',
        selectedIndex: 0,
        selectedEntry: nextEntry,
        entries: [nextEntry],
        sections: TUTORIAL_CONTENT_DATA.GALLERY.sections,
        selectionProgress: 1,
        pageTurn: {
            active: true, progress: 0.35, direction: 1, webglAvailable: true,
            previousGallery: {
                selectedSectionId: 'cutscenes', selectedIndex: 0,
                selectedEntry: oldEntry, entries: [oldEntry]
            }
        }
    };
    gallery.draw(viewModel);
    assert.equal(screenCommands.length, 0);
    assert.equal(snapshots.length, 2);
    assert.equal(snapshots[0].some((c) => c.text === oldEntry.title), true);
    assert.equal(snapshots[1].some((c) => c.text === nextEntry.title), true);
    assert.equal(snapshots.every((commands) => commands.some((c) => c.image === asset)), true);

    accepted = false;
    gallery.draw(viewModel);
    assert.equal(screenCommands.some((c) => c.text === oldEntry.title), true,
        'WebGL 실패 시 같은 프레임에 기존 2D 내용을 복구해야 합니다.');
});

test('WebGL pageTurn은 양면 실제 텍스처·원근 보정·깊이·그림자를 함께 사용한다', async () => {
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
    assert.match(PAGE_FRAGMENT_SHADER, /texture2D\(u_pageTexture, v_sourceUv\)/);
    assert.match(PAGE_FRAGMENT_SHADER, /texture2D\(u_backTexture, v_backUv\)/);
    assert.doesNotMatch(PAGE_FRAGMENT_SHADER, /finishFade/);
    assert.match(PAGE_VERTEX_SHADER, /perspectiveScale/);
    assert.match(PAGE_VERTEX_SHADER, /clipW/);
    assert.match(PAGE_VERTEX_SHADER, /u_backPageRect/);
    assert.match(SPREAD_FRAGMENT_SHADER, /revealed/);
    assert.match(passSource, /gl\.enable\(gl\.DEPTH_TEST\)/);
    assert.match(passSource, /gl\.drawElements\(gl\.TRIANGLES/);
    assert.match(registrySource, /new PageTurnEffectPass\(gl\)/);
});

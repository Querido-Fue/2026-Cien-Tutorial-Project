import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_RECORD_PRESENTATION_DATA } from '../project/engine/script/data/game/tutorial_record_presentation_data.js';
import {
    TUTORIAL_RECORD_POPUP_PHASES,
    TutorialRecordPopupController
} from '../project/engine/script/scene/tutorial/_tutorial_record_popup_controller.js';
import { TutorialGalleryView } from '../project/engine/script/scene/tutorial/view/_tutorial_gallery_view.js';
import { TutorialRecordBackdropView } from '../project/engine/script/scene/tutorial/view/_tutorial_record_backdrop_view.js';

/** @returns {object} 완료 시점을 직접 제어하는 애니메이션 대역입니다. */
function createAnimationHarness() {
    let nextId = 0;
    const pending = [];
    return {
        pending,
        port: {
            animate(owner, spec) {
                const id = nextId++;
                let resolve = () => {};
                const animation = {
                    id,
                    owner,
                    spec,
                    settled: false,
                    promise: new Promise((done) => { resolve = done; }),
                    finish() {
                        if (this.settled) {
                            return;
                        }
                        this.settled = true;
                        owner[spec.variable] = spec.endValue;
                        resolve();
                    }
                };
                owner[spec.variable] = spec.startValue;
                pending.push(animation);
                return { id, promise: animation.promise };
            },
            remove(id) {
                pending.find((animation) => animation.id === id)?.finish();
            }
        }
    };
}

/** @param {object} harness - 애니메이션 대역입니다. */
async function finishNextAnimation(harness) {
    const animation = harness.pending.find((entry) => !entry.settled);
    assert.ok(animation);
    animation.finish();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
}

test('기록 책은 0.6초 easeOutExpo로 열리고 0.4초 easeInExpo로 역재생된다', async () => {
    const harness = createAnimationHarness();
    const backdrop = { sync() {}, clear() {}, destroy() {} };
    const closed = [];
    const controller = new TutorialRecordPopupController({
        animationPort: harness.port,
        config: TUTORIAL_RECORD_PRESENTATION_DATA,
        backdropView: backdrop
    });
    controller.enqueue(['lora-diary:1']);

    assert.equal(controller.openNext((id) => id === 'lora-diary:1'), true);
    assert.equal(controller.getSnapshot().phase, TUTORIAL_RECORD_POPUP_PHASES.OPENING);
    assert.equal(harness.pending[0].spec.duration, 0.6);
    assert.equal(harness.pending[0].spec.type, 'easeOutExpo');
    assert.equal(controller.createButtonPresentation({ alpha: 1 }).interactive, false);

    harness.pending[0].owner.progress = 0.5;
    assert.equal(controller.getSnapshot().scale, 0.86);
    assert.equal(controller.getSnapshot().pageProgress, 0.5);
    await finishNextAnimation(harness);
    assert.equal(controller.getSnapshot().phase, TUTORIAL_RECORD_POPUP_PHASES.OPEN);

    assert.equal(controller.close((id) => closed.push(id)), true);
    assert.equal(controller.getSnapshot().phase, TUTORIAL_RECORD_POPUP_PHASES.CLOSING);
    assert.equal(harness.pending[1].spec.duration, 0.4);
    assert.equal(harness.pending[1].spec.type, 'easeInExpo');
    assert.equal(harness.pending[1].spec.startValue, 1);
    assert.equal(harness.pending[1].spec.endValue, 0);

    await finishNextAnimation(harness);
    assert.deepEqual(closed, ['lora-diary:1']);
    assert.equal(controller.getSnapshot().phase, TUTORIAL_RECORD_POPUP_PHASES.CLOSED);
    assert.equal(controller.hasWork(), false);
});

test('기록 배경은 게임 vignette를 진행도만큼 블러·감광하고 닫힐 때 복원한다', () => {
    const style = {
        webkitBackdropFilter: '',
        backdropFilter: '',
        backgroundColor: 'transparent',
        willChange: ''
    };
    const backdrop = new TutorialRecordBackdropView(
        TUTORIAL_RECORD_PRESENTATION_DATA.BACKDROP,
        () => ({ style })
    );
    backdrop.sync({ visible: true, progress: 0.5 });

    assert.equal(style.backdropFilter, 'blur(5px) brightness(0.79)');
    assert.equal(style.webkitBackdropFilter, style.backdropFilter);
    assert.equal(style.backgroundColor, 'rgba(5, 3, 8, 0.14)');
    backdrop.clear();
    assert.equal(style.backdropFilter, '');
    assert.equal(style.backgroundColor, 'transparent');
    assert.equal(style.willChange, '');
});

test('전투 기록 책은 top 레이어에서 확대·페이드·페이지 프레임을 함께 적용한다', () => {
    const commands = [];
    const assets = new Map();
    const asset = (key) => {
        if (!assets.has(key)) {
            assets.set(key, { key, width: 300, height: 220 });
        }
        return assets.get(key);
    };
    const view = new TutorialGalleryView({
        render(layer, command) {
            commands.push({ layer, command });
        },
        renderGL(layer, command) {
            commands.push({ layer, command });
        },
        wrapText: (text) => [String(text)]
    }, { getUiAsset: asset });
    const viewModel = {
        viewport: { WW: 1280, WH: 720, UIWW: 1280, UIOffsetX: 0 },
        colors: { UI: { PanelStrong: '#221122', Text: '#fff', Muted: '#aaa' } },
        fonts: { SMALL: '16px LanaPixel' },
        sections: [
            { id: 'lora-diary', title: '로라의 일기', bookmarkAssetKey: 'bookmark' }
        ],
        entries: [{ id: 'lora-diary:1', title: '첫 기록', body: '본문', unlocked: true }],
        selectedSectionId: 'lora-diary',
        selectedEntry: { id: 'lora-diary:1', body: '본문', unlocked: true },
        selectedIndex: 0,
        recordPopup: true,
        recordPresentation: {
            progress: 0.5,
            scale: 0.86,
            pageProgress: 0.5,
            contentAlpha: 0.4,
            interactive: false
        }
    };
    const finalLayout = view.getLayout(viewModel);
    view.draw(viewModel);

    const book = commands.find(({ command }) => command.image?.key === 'endingBook2');
    assert.equal(book.layer, 'top');
    assert.equal(book.command.alpha, 0.5);
    assert.ok(book.command.w < finalLayout.book.w);
    assert.equal(commands.find(({ command }) => command.text === '본문').command.alpha, 0.4);
    assert.ok(view.getButtonSpecs(viewModel).every(({ layer }) => layer === 'top'));
});

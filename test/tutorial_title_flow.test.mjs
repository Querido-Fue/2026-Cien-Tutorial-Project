import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import {
    TUTORIAL_TITLE_PHASES,
    TutorialTitleFlowController
} from '../project/engine/script/scene/tutorial/_tutorial_title_flow_controller.js';
import { TutorialTitleTransitionView } from '../project/engine/script/scene/tutorial/view/_tutorial_title_transition_view.js';

/**
 * 완료 시점을 테스트가 직접 제어할 수 있는 AnimationSystem 대역을 만듭니다.
 * @returns {object} 애니메이션 포트와 대기 작업 목록입니다.
 */
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

/** 다음 애니메이션을 완료하고 연쇄 Promise가 다음 단계로 진행되게 합니다. */
async function finishNextAnimation(harness) {
    const animation = harness.pending.find((entry) => !entry.settled);
    assert.ok(animation, '완료할 애니메이션이 있어야 합니다.');
    animation.finish();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
}

/** @param {object} harness @param {object} options @returns {TutorialTitleFlowController} */
function createController(harness, options = {}) {
    return new TutorialTitleFlowController({
        animationPort: harness.port,
        choices: TUTORIAL_GAME_DATA.STARTER_CHOICES,
        config: TUTORIAL_GAME_DATA.ANIMATION,
        initialItemId: 'mascot-costume',
        ...options
    });
}

test('타이틀 버튼 퇴장 뒤 같은 장면의 스타터 카드가 expo 순서로 진입한다', async () => {
    const harness = createAnimationHarness();
    const phases = [];
    let swapCount = 0;
    const controller = createController(harness, {
        onChange(snapshot) {
            phases.push(snapshot.phase);
        }
    });

    assert.equal(controller.openStarter({ onSwap: () => { swapCount += 1; } }), true);
    assert.equal(controller.getSnapshot().phase, TUTORIAL_TITLE_PHASES.MENU_EXIT);
    assert.equal(controller.getButtonPresentation().interactive, false);
    assert.equal(controller.openStarter(), false);
    assert.equal(harness.pending[0].spec.type, 'easeOutExpo');
    assert.equal(
        harness.pending[0].spec.duration,
        TUTORIAL_GAME_DATA.ANIMATION.TITLE_MENU_EXIT_SECONDS
    );

    await finishNextAnimation(harness);
    assert.equal(swapCount, 1);
    assert.equal(controller.getSnapshot().phase, TUTORIAL_TITLE_PHASES.STARTER_ENTER);
    assert.equal(harness.pending[1].spec.type, 'easeOutExpo');

    await finishNextAnimation(harness);
    assert.equal(controller.getSnapshot().phase, TUTORIAL_TITLE_PHASES.IDLE);
    assert.equal(controller.isLocked(), false);
    assert.ok(phases.includes(TUTORIAL_TITLE_PHASES.MENU_EXIT));
    assert.ok(phases.includes(TUTORIAL_TITLE_PHASES.STARTER_ENTER));
});

test('선택 아이콘 모핑이 끝난 뒤 전투를 준비하고 공개 완료 후 컷씬을 넘긴다', async () => {
    const harness = createAnimationHarness();
    const readyItems = [];
    const completedContexts = [];
    let selectionChanges = 0;
    const controller = createController(harness, {
        onSelectionChange() {
            selectionChanges += 1;
        }
    });

    assert.equal(controller.choose('bow', {
        onBattleReady(itemId) {
            readyItems.push(itemId);
            return ['opening'];
        },
        onRevealComplete(context) {
            completedContexts.push(context);
        }
    }), true);
    assert.equal(selectionChanges, 1);
    assert.deepEqual(readyItems, []);
    assert.equal(controller.getSnapshot().phase, TUTORIAL_TITLE_PHASES.STARTER_MORPH);
    assert.equal(controller.getSnapshot().selectedItemId, 'bow');
    assert.equal(controller.getButtonPresentation().alpha, 1);

    await finishNextAnimation(harness);
    assert.deepEqual(readyItems, ['bow']);
    assert.equal(controller.getSnapshot().phase, TUTORIAL_TITLE_PHASES.BATTLE_REVEAL);
    assert.equal(harness.pending[1].spec.type, 'easeOutExpo');

    await finishNextAnimation(harness);
    assert.deepEqual(completedContexts, [['opening']]);
    assert.equal(controller.getSnapshot().phase, TUTORIAL_TITLE_PHASES.IDLE);
    assert.equal(controller.getSelectedItemId(), 'bow');
});

test('타이틀 전환 뷰는 카드 아이콘을 플레이어 첫 슬롯의 시각 중심으로 이동시킨다', () => {
    const commands = [];
    const bow = { width: 48, height: 48 };
    const view = new TutorialTitleTransitionView({
        render(layer, command) {
            commands.push({ layer, command });
        }
    }, {
        getUiAsset(key) {
            return key === 'playerPanel' ? { width: 232, height: 78 } : null;
        },
        getItemIcon() {
            return bow;
        }
    });
    const base = {
        viewport: { WW: 1280, WH: 720, UIWW: 1280, UIOffsetX: 0 },
        colors: { WorldBackdrop: '#101010' },
        sourceRect: { x: 530, y: 410, w: 72, h: 72 },
        playerStatusRect: { x: 60, y: 585, w: 288, h: 92 },
        inventoryLayout: TUTORIAL_GAME_DATA.LAYOUT.INVENTORY,
        itemIconLayout: TUTORIAL_GAME_DATA.SPRITES.ITEM
    };
    const morphModel = {
        ...base,
        transition: {
            phase: TUTORIAL_TITLE_PHASES.STARTER_MORPH,
            progress: 0.5,
            selectedItemId: 'bow'
        }
    };
    const layout = view.getLayout(morphModel);
    assert.ok(layout.targetRect.x >= base.playerStatusRect.x);
    assert.ok(layout.targetRect.y >= base.playerStatusRect.y);
    assert.ok(layout.targetRect.w < base.sourceRect.w);
    assert.ok(layout.currentRect.x < base.sourceRect.x);
    assert.ok(layout.currentRect.x > layout.targetRect.x);

    view.draw(morphModel);
    assert.equal(commands.at(-1).command.image, bow);
    assert.deepEqual(
        (({ x, y, w, h }) => ({ x, y, w, h }))(commands.at(-1).command),
        layout.currentRect
    );

    commands.length = 0;
    view.draw({
        ...base,
        transition: {
            phase: TUTORIAL_TITLE_PHASES.BATTLE_REVEAL,
            progress: 0.5,
            selectedItemId: 'bow'
        }
    });
    assert.equal(commands[0].command.fill, '#101010');
    assert.equal(commands[0].command.alpha, 0.5);
    assert.equal(commands[1].command.alpha, 0.5);
});

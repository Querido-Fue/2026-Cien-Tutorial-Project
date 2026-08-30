import assert from 'node:assert/strict';
import test from 'node:test';

import { TutorialBattleViewModelFactory } from '../project/engine/script/scene/tutorial/_tutorial_battle_view_model_factory.js';
import { TutorialCombatReadabilityPresenter } from '../project/engine/script/scene/tutorial/_tutorial_combat_readability_presenter.js';

const TARGET = Object.freeze({
    id: 'slime-1',
    type: 'mob',
    x: 3,
    y: 2,
    hp: 60,
    maxHp: 100,
    distance: 1,
    weapon: 'melee'
});
const ATTACK_CURSOR_ICON = Object.freeze({ naturalWidth: 1038, naturalHeight: 1104 });

/** @returns {object} 커서 계약 검증용 최소 전투 뷰 모델 입력입니다. */
function createInput() {
    const snapshot = {
        phase: 'action',
        actionUsed: false,
        floorIndex: 0,
        player: { x: 2, y: 2, hp: 100 },
        lora: { hp: 100, instability: 0 }
    };
    const model = {
        phase: 'action',
        result: null,
        getSnapshot: () => snapshot,
        getValidTargets: ({ weapon }) => weapon === 'melee' ? [TARGET] : [],
        getCleanseTargets: () => [],
        getLoraIntent: () => ({}),
        getInstabilityState: () => ({ id: 'stable' }),
        previewPlayerAction: (_action, options) => ({
            ok: true,
            reason: 'action-available',
            action: 'attack',
            targetId: options.targetId,
            targetType: 'mob',
            targetHpBefore: 60,
            targetHpAfter: 42,
            before: { playerHp: 100, loraHp: 100, targetHp: 60 },
            expected: { playerHp: 100, loraHp: 100, targetHp: 42 },
            changes: { targetHp: -18 }
        })
    };
    return {
        model,
        floor: { index: 0 },
        layout: { viewport: { WW: 1280, WH: 720 } },
        fonts: {
            BUTTON: '700 20px PFStardust',
            SMALL: '400 16px PFStardust'
        },
        colors: {
            UI: {
                Panel: '#panel',
                Accent: '#accent',
                Text: '#text',
                Danger: '#danger'
            }
        },
        attackCursorIcon: ATTACK_CURSOR_ICON,
        elapsedSeconds: 0,
        presentation: { floorIndex: 0 },
        presentationLocked: false,
        feedback: {
            eventLog: [],
            floatingTexts: [],
            notices: [],
            particles: [],
            flashSeconds: 0,
            stabilizeSeconds: 0
        },
        spriteAnimations: {},
        battleEffects: [],
        floorActors: null,
        ready: true,
        achievement: null,
        selection: {
            plannedPath: [{ x: 2, y: 2 }],
            reachability: new Map(),
            hoveredTile: { x: TARGET.x, y: TARGET.y },
            attackSelected: true,
            attackWeapon: 'melee',
            actionTargets: [TARGET],
            targetIndex: 0,
            cleanseSelected: false,
            cleanseTargets: [],
            cleanseTargetIndex: 0
        },
        buttonHoverScales: {}
    };
}

/** @returns {TutorialBattleViewModelFactory} 실제 표시 프레젠터를 쓰는 팩토리입니다. */
function createFactory() {
    return new TutorialBattleViewModelFactory({
        data: {
            ITEMS: {},
            LAYOUT: {
                ACTIONS: {},
                INVENTORY: {},
                BOARD: { PATH_PREVIEW: {}, SHADOW_PROJECTION: {} }
            },
            SPRITES: { ITEM: {}, RECORD: {}, LORA: {} },
            ANIMATION: {
                SELECTION_MIN_SCALE: 0.72,
                ACTION_PLAYER_SCALE: 1,
                ACTION_LORA_SCALE: 1
            },
            RULES: { FLOOR_TRANSITION_AFTER_TURN: 6 },
            ACTORS: {
                PLAYER: { ATTACK_RANGE: 2, MOVE_RANGE: 4, HEAL_AMOUNT: 15 }
            },
            TEXT: {}
        },
        inventoryPresenter: {
            createView: () => ({
                entries: [],
                pagedInventory: { entries: [] },
                itemMetadata: {}
            })
        },
        combatReadability: new TutorialCombatReadabilityPresenter(),
        battleFocus: {
            setKeys() {},
            getFocusedKey: () => null
        }
    });
}

test('공격 선택 중 슬라임 호버는 칼 커서와 실제 모델 HP 미리보기를 만든다', () => {
    const viewModel = createFactory().create(createInput());

    assert.equal(viewModel.cursor.type, 'attack');
    assert.equal(viewModel.cursor.icon, ATTACK_CURSOR_ICON);
    assert.deepEqual(viewModel.cursor.info, {
        title: '슬라임',
        detail: 'HP 60 → 42',
        titleFont: '700 20px PFStardust',
        detailFont: '400 16px PFStardust',
        colors: {
            panel: '#panel',
            border: '#accent',
            title: '#text',
            detail: '#danger'
        }
    });
});

test('공격 모드는 유지하되 유효 대상이 아닌 타일에서는 HP 패널을 숨긴다', () => {
    const input = createInput();
    input.selection.hoveredTile = { x: 8, y: 7 };
    const viewModel = createFactory().create(input);

    assert.equal(viewModel.cursor.type, 'attack');
    assert.equal(viewModel.cursor.icon, ATTACK_CURSOR_ICON);
    assert.equal(viewModel.cursor.info, null);
});

test('공격을 선택하지 않았거나 입력이 잠기면 일반 커서로 복귀한다', () => {
    const idleInput = createInput();
    idleInput.selection.attackSelected = false;
    assert.deepEqual(
        createFactory().create(idleInput).cursor,
        { type: 'normal', info: null }
    );

    const lockedInput = createInput();
    lockedInput.ready = false;
    assert.deepEqual(
        createFactory().create(lockedInput).cursor,
        { type: 'normal', info: null }
    );
});

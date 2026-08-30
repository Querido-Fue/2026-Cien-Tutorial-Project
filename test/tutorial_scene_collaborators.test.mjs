import assert from 'node:assert/strict';
import test from 'node:test';

import { TutorialBattleCommandController } from '../project/engine/script/scene/tutorial/_tutorial_battle_command_controller.js';
import { TutorialBattleOutcomeCoordinator } from '../project/engine/script/scene/tutorial/_tutorial_battle_outcome_coordinator.js';
import { TutorialBattleViewModelFactory } from '../project/engine/script/scene/tutorial/_tutorial_battle_view_model_factory.js';
import { TutorialBattleSelectionController } from '../project/engine/script/scene/tutorial/_tutorial_battle_selection_controller.js';
import { TutorialInventoryPresenter } from '../project/engine/script/scene/tutorial/_tutorial_inventory_presenter.js';
import { TutorialKeyboardEdgeTracker } from '../project/engine/script/scene/tutorial/_tutorial_keyboard_edge_tracker.js';
import { TutorialKeyboardCommandMapper } from '../project/engine/script/scene/tutorial/_tutorial_keyboard_command_mapper.js';
import { TutorialLoraTurnController } from '../project/engine/script/scene/tutorial/_tutorial_lora_turn_controller.js';
import { TutorialMetaSession } from '../project/engine/script/scene/tutorial/_tutorial_meta_session.js';
import { TutorialNonbattleViewModelFactory } from '../project/engine/script/scene/tutorial/_tutorial_nonbattle_view_model_factory.js';
import { TutorialResultController } from '../project/engine/script/scene/tutorial/_tutorial_result_controller.js';
import { createDefaultTutorialMeta } from '../project/engine/script/scene/tutorial/_tutorial_meta_progress.js';
import {
    TUTORIAL_COMMANDS,
    TUTORIAL_MODES
} from '../project/engine/script/scene/tutorial/_tutorial_scene_constants.js';

test('키보드 에지 추적기는 유지 입력과 프레임 사이 빠른 탭을 구분한다', () => {
    const down = new Map([['KeyA', false], ['KeyB', false]]);
    let snapshot = { lastEvent: { code: 'KeyA', pressed: false, timeStamp: 1 } };
    const tracker = new TutorialKeyboardEdgeTracker({
        watchedCodes: ['KeyA', 'KeyB'],
        getCodeInput: (code) => down.get(code) === true,
        getSnapshot: () => snapshot
    });

    down.set('KeyA', true);
    tracker.prepare();
    assert.equal(tracker.wasPressed('KeyA'), true);
    tracker.capture();

    tracker.prepare();
    assert.equal(tracker.wasPressed('KeyA'), false);

    snapshot = { lastEvent: { code: 'KeyB', pressed: false, timeStamp: 2 } };
    tracker.prepare();
    assert.equal(tracker.wasPressed('KeyB'), true);
    assert.equal(tracker.wasAnyPressed(['KeyA', 'KeyB']), true);
});

test('메타 세션은 런 중 변경을 staging하고 이탈 시 한 번만 저장한다', async () => {
    const saved = [];
    const session = new TutorialMetaSession({
        initialMeta: createDefaultTutorialMeta(),
        save: async (meta) => saved.push(meta)
    });

    session.beginStaging();
    session.unlockAchievements(['first-defeat']);
    session.markCombatGuideSeen();
    await session.whenIdle();
    assert.equal(saved.length, 0);

    session.commitStaged();
    await session.whenIdle();
    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0].unlockedAchievementIds, ['first-defeat']);
    assert.equal(saved[0].combatGuideSeen, true);
});

test('메타 세션은 획득 기록을 staging 중에도 즉시 확정한다', async () => {
    const saved = [];
    const session = new TutorialMetaSession({
        initialMeta: createDefaultTutorialMeta(),
        save: async (meta) => saved.push(meta)
    });

    session.beginStaging();
    session.syncBattleSnapshot({
        usedItems: ['ocarina'],
        knowledge: {
            identifiedItemIds: ['bow'],
            unlockedRecordIds: ['lora-diary-1']
        }
    });
    await session.whenIdle();

    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0].identifiedItemIds, ['ocarina', 'bow']);
    assert.deepEqual(saved[0].unlockedRecordIds, ['lora-diary-1']);
});

test('메타 세션은 저장 차단 상태에서 메모리 진행만 유지한다', async () => {
    const saved = [];
    const session = new TutorialMetaSession({
        save: async (meta) => saved.push(meta)
    });
    session.setWritesBlocked(true);
    session.recordResult('true-ending');
    await session.whenIdle();

    assert.equal(session.current.playCount, 1);
    assert.deepEqual(session.current.endingIds, ['true-ending']);
    assert.equal(saved.length, 0);
});

test('키보드 명령 매퍼는 화면별 우선순위와 선택 payload를 보존한다', () => {
    const mapper = new TutorialKeyboardCommandMapper();
    assert.deepEqual(
        mapper.map({ mode: TUTORIAL_MODES.MENU }, ['KeyG', 'Enter']),
        { type: TUTORIAL_COMMANDS.OPEN_GALLERY }
    );
    assert.deepEqual(
        mapper.map({
            mode: TUTORIAL_MODES.PAUSE,
            pauseIndex: 2
        }, ['Enter']),
        { type: TUTORIAL_COMMANDS.RETURN_MENU }
    );
    assert.deepEqual(
        mapper.map({
            mode: TUTORIAL_MODES.BATTLE,
            canAcceptBattleInput: true,
            cleanseSelected: true,
            selectedCleanseTarget: { id: 'event-1', x: 2, y: 3 }
        }, ['Enter']),
        {
            type: TUTORIAL_COMMANDS.CLEANSE_EVENT_TILE,
            payload: { id: 'event-1', x: 2, y: 3 }
        }
    );
});

test('전투 선택 컨트롤러는 경로 연장·포탈 단위 되돌리기·초기화를 소유한다', () => {
    const model = {
        player: { x: 1, y: 1 },
        phase: 'move',
        movementUsed: false,
        actionUsed: false,
        extendPath(path, dx, dy) {
            return [...path, {
                x: path.at(-1).x + dx,
                y: path.at(-1).y + dy
            }];
        },
        getReachability: () => new Map([['2,1', 1]]),
        getCleanseTargets: () => []
    };
    const selection = new TutorialBattleSelectionController();
    selection.reset(model);
    selection.refresh(model);

    assert.equal(selection.planStep(model, 1, 0), 'path');
    assert.deepEqual(selection.getSnapshot().plannedPath, [
        { x: 1, y: 1 },
        { x: 2, y: 1 }
    ]);
    assert.equal(selection.backtrackPath(model), true);
    assert.deepEqual(selection.getSnapshot().plannedPath, [{ x: 1, y: 1 }]);

    selection.planStep(model, 1, 0);
    assert.equal(selection.resetPath(model), true);
    assert.deepEqual(selection.getSnapshot().plannedPath, [{ x: 1, y: 1 }]);
    assert.equal(selection.getSnapshot().reachability.has('2,1'), true);
});

test('전투 선택 컨트롤러는 공격 대상 호버와 보드 명령을 일관되게 만든다', () => {
    const targets = [
        { id: 'lora', x: 3, y: 2 },
        { id: 'dummy', x: 4, y: 2 }
    ];
    const model = {
        player: { x: 2, y: 2 },
        phase: 'action',
        movementUsed: true,
        actionUsed: false,
        getValidTargets: () => targets,
        getCleanseTargets: () => []
    };
    const selection = new TutorialBattleSelectionController();
    selection.reset(model);

    assert.deepEqual(selection.toggleAttack(model, 'bow'), {
        changed: true,
        focusKey: 'battle-ranged'
    });
    selection.refresh(model);
    assert.deepEqual(selection.setHoveredTile({ x: 4, y: 2 }), {
        hoverChanged: true,
        targetChanged: true
    });
    assert.deepEqual(selection.createPointerCommand(model), {
        type: TUTORIAL_COMMANDS.ATTACK,
        payload: { targetId: 'dummy' }
    });
    assert.deepEqual(selection.createAttackRequest(), {
        targetId: 'dummy',
        weapon: 'bow'
    });

    const snapshot = selection.getSnapshot();
    snapshot.actionTargets[1].id = 'mutated';
    assert.equal(selection.createAttackRequest().targetId, 'dummy');
});

test('전투 명령 컨트롤러는 경로 확정 결과와 텔레포트 연출을 같은 모델 호출에서 만든다', () => {
    const selection = new TutorialBattleSelectionController();
    const modelChanges = [];
    const playerPaths = [];
    const model = {
        player: { x: 0, y: 0 },
        floorIndex: 1,
        phase: 'move',
        movementUsed: false,
        actionUsed: false,
        extendPath(path, dx, dy) {
            return [...path, { x: dx, y: dy }];
        },
        commitPath(path) {
            this.player = { ...path.at(-1) };
            this.movementUsed = true;
            return {
                ok: true,
                path,
                events: [{
                    type: 'teleported',
                    from: { x: 1, y: 0 },
                    to: { x: 4, y: 4 }
                }]
            };
        }
    };
    selection.reset(model);
    selection.planStep(model, 1, 0);
    const commands = new TutorialBattleCommandController({
        selection,
        focus: { focus() {} },
        presentation: {
            startSelection() {},
            startAction() {},
            startPlayerPath(value) {
                playerPaths.push(value);
            }
        },
        getModel: () => model,
        canAcceptInput: () => true,
        onModelChange: (result) => modelChanges.push(result),
        getVisibleFloorIndex: () => 0
    });

    commands.applyCommitPath();

    assert.equal(modelChanges.length, 1);
    assert.deepEqual(playerPaths[0].teleportSegments, [{
        from: { x: 1, y: 0 },
        to: { x: 4, y: 4 }
    }]);
    assert.equal(playerPaths[0].logicalFloorIndex, 1);
    assert.equal(playerPaths[0].visibleFloorIndex, 0);
    assert.deepEqual(selection.getPlannedPath(), [{ x: 1, y: 0 }]);
});

test('전투 명령 컨트롤러는 공격 선택과 실행 검증을 모델 밖에 중복하지 않는다', () => {
    const selection = new TutorialBattleSelectionController();
    const focused = [];
    const attacked = [];
    const actions = [];
    const model = {
        player: { x: 0, y: 0 },
        phase: 'action',
        movementUsed: true,
        actionUsed: false,
        getValidTargets: () => [{ id: 'lora', x: 1, y: 0 }],
        getCleanseTargets: () => [],
        attack(targetId, options) {
            attacked.push({ targetId, options });
            return { ok: true, events: [] };
        }
    };
    selection.reset(model);
    const commands = new TutorialBattleCommandController({
        selection,
        focus: { focus: (key) => focused.push(key) },
        presentation: {
            startSelection() {},
            startAction: () => actions.push('action'),
            startPlayerPath() {}
        },
        getModel: () => model,
        canAcceptInput: () => true,
        onModelChange() {},
        getVisibleFloorIndex: () => 0
    });

    commands.applySelectAttack({ weapon: 'bow' });
    commands.applyAttack({ targetId: 'lora' });

    assert.deepEqual(focused, ['battle-ranged']);
    assert.deepEqual(attacked, [{
        targetId: 'lora',
        options: { weapon: 'bow' }
    }]);
    assert.deepEqual(actions, ['action']);
    assert.equal(selection.isAttackSelected(), false);
});

test('전투 명령 컨트롤러는 이동 단계 아이템 사용을 모델 호출 전에 거절한다', () => {
    const modelChanges = [];
    const itemCalls = [];
    const actionPresentations = [];
    const model = {
        phase: 'move',
        actionUsed: false,
        useItem(itemId) {
            itemCalls.push(itemId);
            return { ok: true, events: [] };
        }
    };
    const commands = new TutorialBattleCommandController({
        selection: { clearAttack() {} },
        focus: { focus() {} },
        presentation: {
            startSelection() {},
            startAction: () => actionPresentations.push('action'),
            startPlayerPath() {}
        },
        getModel: () => model,
        canAcceptInput: () => true,
        onModelChange: (result) => modelChanges.push(result),
        getVisibleFloorIndex: () => 0
    });

    commands.applyUseItem({ itemId: 'ocarina' });

    assert.deepEqual(itemCalls, []);
    assert.deepEqual(actionPresentations, []);
    assert.deepEqual(modelChanges, [{
        ok: false,
        reason: 'movement-command-required',
        events: []
    }]);

    model.phase = 'action';
    commands.applyUseItem({ itemId: 'ocarina' });
    assert.deepEqual(itemCalls, ['ocarina']);
    assert.deepEqual(actionPresentations, ['action']);
    assert.deepEqual(modelChanges[1], { ok: true, events: [] });
});

test('로라 턴 컨트롤러는 같은 세대에서 행동과 완료를 각각 한 번만 예약한다', () => {
    const queued = [];
    const changes = [];
    const selectionCalls = [];
    const model = {
        turn: 'lora',
        player: { x: 2, y: 3 },
        performLoraTurn: () => ({ ok: true, stage: 'performed' }),
        completeLoraTurn() {
            this.turn = 'player';
            return { ok: true, stage: 'completed' };
        }
    };
    const turns = new TutorialLoraTurnController({
        getModel: () => model,
        getRevision: () => 7,
        canApply: () => true,
        canSchedule: () => true,
        enqueueCommand: (command) => queued.push(command),
        onModelChange: (result) => changes.push(result.stage),
        selection: {
            clearActionSelections: () => selectionCalls.push('clear'),
            resetPath: (value) => selectionCalls.push(['reset', value.player])
        },
        beforeSeconds: 0.2,
        showSeconds: 0.4
    });

    assert.equal(turns.armIfNeeded(), true);
    turns.update(0.2);
    turns.update(1);
    assert.deepEqual(queued, [{
        type: TUTORIAL_COMMANDS.PERFORM_LORA,
        payload: { timelineRevision: 7 }
    }]);

    turns.applyAction({ timelineRevision: 6 });
    assert.deepEqual(changes, []);
    turns.applyAction({ timelineRevision: 7 });
    turns.update(0.4);
    assert.equal(queued[1].type, TUTORIAL_COMMANDS.COMPLETE_LORA);

    turns.applyCompletion({ timelineRevision: 7 });
    assert.deepEqual(changes, ['performed', 'completed']);
    assert.deepEqual(selectionCalls, [
        'clear',
        ['reset', { x: 2, y: 3 }]
    ]);
});

test('결과 컨트롤러는 연출 차단 뒤 엔딩 데이터와 컷씬을 한 번만 확정한다', () => {
    const recorded = [];
    const results = new TutorialResultController({
        endings: [
            { id: 'failure', displayName: '실패', cutsceneId: null },
            { id: 'true-ending', displayName: '진엔딩', cutsceneId: 'ending-true' }
        ],
        recordResult: (endingId) => recorded.push(endingId)
    });
    const model = {
        result: { endingId: 'true-ending', instability: 120 },
        lora: { instability: 80 }
    };
    results.queueEndingCutscene('ending-true');

    assert.equal(results.tryEnter({ model, blocked: true }).entered, false);
    const transition = results.tryEnter({ model, snapshot: {} });

    assert.equal(transition.entered, true);
    assert.equal(transition.endingCutsceneId, 'ending-true');
    assert.equal(transition.data.displayName, '진엔딩');
    assert.equal(transition.data.instability, 100);
    assert.deepEqual(recorded, ['true-ending']);
    assert.equal(results.tryEnter({ model }).entered, false);

    transition.data.displayName = '변조';
    assert.equal(results.getData().displayName, '진엔딩');
});

test('전투 결과 조정자는 cue·진행도·기록·컷씬을 고정 순서로 배포한다', () => {
    const calls = [];
    const presenterInputs = [];
    const coordinator = new TutorialBattleOutcomeCoordinator({
        presenter: {
            createCues(input) {
                calls.push('present');
                presenterInputs.push(input);
                return ['cue'];
            }
        },
        animationCoordinator: {
            route(cues) {
                calls.push('route');
                return cues;
            }
        },
        feedbackQueue: {
            enqueue(cues, context) {
                calls.push(['feedback', context.projectTile({ x: 2, y: 3 })]);
                return cues;
            }
        },
        presentationTimeline: {
            applyCues() {
                calls.push('timeline');
            }
        },
        achievementEvaluator: {
            evaluate() {
                calls.push('evaluate');
                return { unlockedIds: ['achievement'], notifications: ['notice'] };
            }
        },
        metaSession: {
            unlockAchievements(ids) {
                calls.push(['unlock', ids]);
            },
            syncBattleSnapshot(snapshot) {
                calls.push(['sync', snapshot.player.hp]);
            }
        },
        achievementBanner: {
            enqueue() {
                calls.push('banner');
                return 1;
            }
        },
        audioDirector: {
            notifyAchievements(count) {
                calls.push(['audio', count]);
            }
        },
        recordPopups: {
            enqueue(ids) {
                calls.push(['records', ids]);
            }
        },
        cutsceneTriggers: {
            consume() {
                calls.push('triggers');
                return ['ending-cutscene', 'story-cutscene'];
            }
        },
        results: {
            isEndingCutsceneId: (id) => id === 'ending-cutscene',
            queueEndingCutscene(id) {
                calls.push(['ending', id]);
            }
        },
        projectTile: (_layout, tile) => ({ px: tile.x * 10, py: tile.y * 10 }),
        getFeedbackColors: () => ({ danger: '#f00' })
    });
    coordinator.reset({ player: { hp: 90 } });
    const nextSnapshot = { player: { hp: 80 }, lora: { hp: 70 } };
    const output = coordinator.process({
        result: {
            ok: true,
            path: [{ x: 1, y: 1 }],
            events: [{ type: 'record-picked', recordId: 'diary-1' }]
        },
        nextSnapshot,
        layout: { tileSide: 32 },
        unlockedAchievementIds: []
    });

    assert.deepEqual(output.cutsceneIds, ['story-cutscene']);
    assert.deepEqual(presenterInputs[0].previousSnapshot, { player: { hp: 90 } });
    assert.deepEqual(calls, [
        'present',
        'route',
        ['feedback', { px: 20, py: 30 }],
        'timeline',
        'evaluate',
        ['unlock', ['achievement']],
        'banner',
        ['audio', 1],
        ['sync', 80],
        ['records', ['diary-1']],
        'triggers',
        ['ending', 'ending-cutscene']
    ]);

    nextSnapshot.player.hp = 1;
    coordinator.process({
        result: { ok: false, reason: 'blocked', events: [] },
        nextSnapshot: { player: { hp: 60 } },
        layout: {},
        unlockedAchievementIds: []
    });
    assert.equal(presenterInputs[1].previousSnapshot.player.hp, 80);
});

test('비전투 뷰 모델 팩토리는 장면 상태 없이 표시 데이터만 조립한다', () => {
    const factory = new TutorialNonbattleViewModelFactory({
        TEXT: {
            TITLE: 'Nth Player',
            SUBTITLE: 'subtitle',
            TUTORIAL_GUIDE: {
                TITLE: '도움말',
                SENTENCES: ['이동', '행동'],
                REPLAY: '다시 보기'
            }
        },
        STARTER_CHOICES: [{ id: 'bow', label: '활', description: '원거리' }],
        ANIMATION: { SELECTION_MIN_SCALE: 0.72 },
        LAYOUT: { MODAL: { WIDTH_UIWW: 50 } }
    });
    const frame = Object.freeze({ viewport: {}, fonts: {}, colors: {} });
    const menu = factory.createMenu(frame, {
        meta: { playCount: 3 },
        releaseVersion: '0830_1200'
    });
    const gallery = factory.createGallery(frame, {
        gallery: { selectedSectionId: 'records' },
        mode: TUTORIAL_MODES.RECORD,
        selectionProgress: 0.5
    });

    assert.equal(menu.playCount, 3);
    assert.equal(menu.releaseVersion, '0830_1200');
    assert.equal(gallery.recordPopup, true);
    assert.equal(gallery.closeCommandType, TUTORIAL_COMMANDS.CLOSE_RECORD);
    assert.equal(Object.isFrozen(menu), true);
});

test('인벤토리 프레젠터와 전투 뷰 모델 팩토리는 페이지·표시 조립만 소유한다', () => {
    const data = {
        ITEMS: {
            bow: {
                label: '활',
                description: '원거리 공격',
                passive: true
            },
            ocarina: {
                label: '시간의 오카리나',
                description: '여분의 행동을 얻습니다.',
                useOnce: true
            }
        },
        LAYOUT: {
            INVENTORY: { PAGE_SIZE: 5 },
            ACTIONS: {},
            BOARD: { PATH_MARKER_RATIO: 0.2, SHADOW_PROJECTION: {} }
        },
        ANIMATION: {
            SELECTION_MIN_SCALE: 0.72,
            ACTION_PLAYER_SCALE: 1,
            ACTION_LORA_SCALE: 1
        },
        SPRITES: { ITEM: {}, RECORD: {}, LORA: {} },
        RULES: { FLOOR_TRANSITION_AFTER_TURN: 6 },
        ACTORS: {
            PLAYER: { ATTACK_RANGE: 1, MOVE_RANGE: 4, HEAL_AMOUNT: 20 }
        },
        TEXT: {}
    };
    const hudView = {
        getInventoryPaging(entries, requestedPage, pageSize) {
            return {
                entries: entries.slice(0, pageSize),
                page: Math.max(0, requestedPage),
                pageCount: 1
            };
        }
    };
    const inventoryPresenter = new TutorialInventoryPresenter({
        data,
        assetPort: { hasItemIcon: () => true },
        hudView
    });
    const battleFocus = {
        keys: [],
        setKeys(keys) {
            this.keys = keys;
        },
        getFocusedKey() {
            return null;
        }
    };
    const factory = new TutorialBattleViewModelFactory({
        data,
        inventoryPresenter,
        combatReadability: { create: () => Object.freeze({}) },
        battleFocus
    });
    const snapshot = {
        phase: 'move',
        actionUsed: false,
        floorIndex: 0,
        player: { x: 0, y: 0 },
        lora: { hp: 100, instability: 0 }
    };
    const model = {
        inventory: new Map([['bow', 1], ['ocarina', 1]]),
        phase: 'move',
        result: null,
        getSnapshot: () => snapshot,
        getValidTargets: () => [],
        getCleanseTargets: () => [],
        previewPath: () => ({ ok: true }),
        getLoraIntent: () => ({}),
        getInstabilityState: () => ({ id: 'stable' }),
        extendPath: (path) => path
    };
    const viewModel = factory.create({
        model,
        floor: { index: 0 },
        layout: { viewport: { WW: 1280, WH: 720 } },
        fonts: {},
        colors: {},
        elapsedSeconds: 0,
        presentation: { floorIndex: 0 },
        presentationLocked: false,
        feedback: {
            eventLog: [],
            floatingTexts: [],
            particles: [],
            flashSeconds: 0,
            stabilizeSeconds: 0
        },
        spriteAnimations: {},
        battleEffects: [{ id: 'arrow-1' }],
        floorActors: null,
        ready: true,
        achievement: null,
        selection: {
            plannedPath: [{ x: 0, y: 0 }],
            reachability: new Map(),
            hoveredTile: null,
            attackSelected: false,
            attackWeapon: 'melee',
            actionTargets: [],
            targetIndex: 0,
            cleanseSelected: false,
            cleanseTargets: [],
            cleanseTargetIndex: 0
        }
    });

    assert.equal(viewModel.hud.inventory.entries[0].itemId, 'bow');
    assert.equal(viewModel.hud.inventory.entries[1].itemId, 'ocarina');
    assert.equal(viewModel.hud.inventory.entries[1].usable, false);
    assert.equal(viewModel.hud.inventory.entries[1].blockedByMovementPhase, true);
    assert.equal(viewModel.hud.controls.hasBow, true);
    assert.deepEqual(viewModel.world.battleEffects, [{ id: 'arrow-1' }]);
    assert.deepEqual(battleFocus.keys, ['item-bow', 'item-ocarina']);
    assert.equal(Object.isFrozen(viewModel), true);
});

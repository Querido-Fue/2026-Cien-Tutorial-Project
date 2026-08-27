import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TutorialBattleModel } from '../project/engine/script/scene/tutorial/_tutorial_battle_model.js';

/**
 * 동결된 원본 데이터와 독립적인 테스트 설정 복제본을 만듭니다.
 * @returns {object} 수정 가능한 게임 설정 복제본입니다.
 */
function cloneGameData() {
    return JSON.parse(JSON.stringify(TUTORIAL_GAME_DATA));
}

/**
 * 지정 스타터로 초기화한 전투 모델을 만듭니다.
 * @param {string} [starterItemId='mascot-costume'] - 지급할 스타터 ID입니다.
 * @param {object} [config=TUTORIAL_GAME_DATA] - 전투 설정입니다.
 * @returns {TutorialBattleModel} 초기화된 전투 모델입니다.
 */
function createModel(starterItemId = 'mascot-costume', config = TUTORIAL_GAME_DATA) {
    const model = new TutorialBattleModel(config);
    if (starterItemId !== 'mascot-costume') {
        model.reset({ starterItemId });
    }
    return model;
}

/**
 * 공식 체크포인트 계약을 이용해 독립된 회귀 시나리오의 시작 상태를 배치합니다.
 * @param {TutorialBattleModel} model - 상태를 배치할 모델입니다.
 * @param {(state:object)=>void} mutate - 복제된 체크포인트 상태 변경 함수입니다.
 * @returns {object} 배치 완료 후 스냅샷입니다.
 */
function seedState(model, mutate) {
    const checkpoint = model.createCheckpoint();
    mutate(checkpoint.state);
    return model.restoreCheckpoint(checkpoint);
}

/**
 * 제자리 이동과 대기를 거쳐 로라 행동 한 회를 완료합니다.
 * @param {TutorialBattleModel} model - 진행할 전투 모델입니다.
 * @returns {object} 로라 행동 완료 결과입니다.
 */
function completeQuietCycle(model) {
    const move = model.commitPath([{ x: model.player.x, y: model.player.y }]);
    assert.equal(move.ok, true);
    const waited = model.wait();
    assert.equal(waited.ok, true);
    const completed = model.completeLoraTurn();
    assert.equal(completed.ok, true);
    return completed;
}

/**
 * 좌표 기반 데이터에서 ID와 좌표만 비교하기 쉬운 튜플로 추립니다.
 * @param {Array<object>} entries - 좌표 기반 데이터입니다.
 * @param {string|null} [valueKey=null] - 함께 추릴 추가 속성입니다.
 * @returns {Array<Array<*>>} ID, 선택 속성, X, Y 순서의 튜플입니다.
 */
function positionTuples(entries, valueKey = null) {
    return entries.map((entry) => valueKey
        ? [entry.id, entry[valueKey], entry.x, entry.y]
        : [entry.id, entry.x, entry.y]);
}

test('기획 데이터의 9×8 좌표와 두 스타터를 고정한다', () => {
    assert.deepEqual(TUTORIAL_GAME_DATA.MAP, { WIDTH: 9, HEIGHT: 8 });
    assert.equal(TUTORIAL_GAME_DATA.RULES.FLOOR_TRANSITION_AFTER_TURN, 6);
    assert.equal(TUTORIAL_GAME_DATA.RULES.MAX_TURNS, 12);
    assert.deepEqual(
        TUTORIAL_GAME_DATA.STARTER_CHOICES.map(({ id }) => id),
        ['bow', 'mascot-costume']
    );

    const [firstFloor, basement] = TUTORIAL_GAME_DATA.FLOORS;
    assert.deepEqual(
        [firstFloor.id, firstFloor.playerStart, firstFloor.loraStart],
        ['first-floor', { x: 4, y: 4 }, { x: 4, y: 0 }]
    );
    assert.deepEqual(
        [basement.id, basement.playerStart, basement.loraStart],
        ['basement', { x: 4, y: 4 }, { x: 4, y: 0 }]
    );

    assert.deepEqual(positionTuples(firstFloor.walls), [
        ['f1-wall-1', 7, 1],
        ['f1-wall-2', 8, 1],
        ['f1-wall-3', 6, 4],
        ['f1-wall-4', 6, 5],
        ['f1-wall-5', 6, 6],
        ['f1-wall-6', 6, 7]
    ]);
    assert.deepEqual(positionTuples(firstFloor.items, 'itemId'), [
        ['f1-ocarina', 'ocarina', 8, 0],
        ['f1-music-box', 'music-box', 8, 2],
        ['f1-teddy', 'old-teddy', 0, 3],
        ['f1-eyeliner', 'eyeliner', 4, 6],
        ['f1-pickaxe', 'diamond-pickaxe', 7, 6]
    ]);
    assert.deepEqual(positionTuples(firstFloor.eventTiles, 'type'), [
        ['f1-event-1', 'damage', 0, 2],
        ['f1-event-3-a', 'instability-up', 6, 2],
        ['f1-event-3-b', 'instability-up', 6, 3],
        ['f1-event-2', 'move-penalty', 2, 5],
        ['f1-event-3-c', 'instability-up', 1, 7]
    ]);
    assert.deepEqual(positionTuples(firstFloor.teleports, 'pairId'), [
        ['f1-teleport-a', 'f1-teleport', 0, 0],
        ['f1-teleport-b', 'f1-teleport', 8, 7]
    ]);
    assert.deepEqual(positionTuples(firstFloor.mobs), [['f1-mob', 0, 7]]);

    assert.deepEqual(positionTuples(basement.walls), [
        ['b1-wall-1', 2, 2],
        ['b1-wall-2', 3, 2],
        ['b1-wall-3', 4, 2],
        ['b1-wall-4', 5, 2],
        ['b1-wall-5', 6, 2],
        ['b1-wall-6', 0, 5],
        ['b1-wall-7', 1, 5],
        ['b1-wall-8', 6, 5],
        ['b1-wall-9', 7, 5],
        ['b1-wall-10', 6, 6],
        ['b1-wall-11', 6, 7]
    ]);
    assert.deepEqual(positionTuples(basement.items, 'itemId'), [
        ['b1-mushroom', 'mushroom', 0, 2],
        ['b1-memory-photo', 'memory-photo', 8, 3],
        ['b1-mirror', 'mirror', 4, 5],
        ['b1-haste', 'haste', 7, 7]
    ]);
    assert.deepEqual(positionTuples(basement.eventTiles, 'type'), [
        ['b1-event-4-a', 'instability-down', 2, 0],
        ['b1-event-4-b', 'instability-down', 6, 0],
        ['b1-event-4-c', 'damage', 2, 1],
        ['b1-event-4-d', 'instability-up', 6, 1]
    ]);
    assert.deepEqual(positionTuples(basement.teleports, 'pairId'), [
        ['b1-teleport-a', 'b1-teleport', 7, 3],
        ['b1-teleport-b', 'b1-teleport', 0, 7]
    ]);
    assert.deepEqual(positionTuples(basement.mobs), [
        ['b1-mob-top', 0, 0],
        ['b1-mob-left', 2, 6],
        ['b1-mob-right', 7, 6]
    ]);

    const defaultModel = createModel();
    assert.deepEqual(defaultModel.getSnapshot().inventory, [
        { itemId: 'mascot-costume', count: 1 }
    ]);
    const bowModel = createModel('bow');
    assert.deepEqual(bowModel.getSnapshot().inventory, [{ itemId: 'bow', count: 1 }]);
    assert.throws(
        () => bowModel.reset({ starterItemId: 'unknown-starter' }),
        RangeError
    );
});

test('이동을 먼저 써야 행동할 수 있고 W-A-D-D 경로는 재방문을 허용한다', () => {
    const model = createModel('bow');
    assert.equal(model.attack().reason, 'action-unavailable');

    const waddPath = [
        { x: 4, y: 4 },
        { x: 4, y: 3 },
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 5, y: 3 }
    ];
    const preview = model.previewPath(waddPath);
    assert.equal(preview.ok, true);
    assert.equal(preview.stepsUsed, 4);
    assert.equal(preview.remainingMoves, 0);

    const moved = model.commitPath(waddPath);
    assert.equal(moved.ok, true);
    assert.deepEqual(moved.path, waddPath);
    assert.deepEqual(model.getSnapshot().player, {
        x: 5,
        y: 3,
        hp: 100,
        maxHp: 100,
        alive: true,
        mushroomActive: false
    });
    assert.equal(model.getSnapshot().phase, 'action');
    assert.equal(model.commitPath([{ x: 5, y: 3 }]).reason, 'movement-unavailable');
    assert.equal(model.wait().ok, true);
    assert.equal(model.getSnapshot().turn, 'lora');
});

test('짝 포탈은 진입 즉시 반대편을 삽입하고 남은 이동력을 유지한다', () => {
    const model = createModel();
    seedState(model, (state) => {
        state.player.x = 1;
        state.player.y = 0;
    });

    let path = [{ x: 1, y: 0 }];
    path = model.extendPath(path, -1, 0);
    assert.ok(path);
    assert.deepEqual(path, [
        { x: 1, y: 0 },
        { x: 0, y: 0 },
        { x: 8, y: 7 }
    ]);
    for (let index = 0; index < 3; index++) {
        path = model.extendPath(path, 0, -1);
        assert.ok(path);
    }

    const preview = model.previewPath(path);
    assert.equal(preview.stepsUsed, 4);
    assert.equal(preview.remainingMoves, 0);
    const moved = model.commitPath(path);
    assert.equal(moved.ok, true);
    assert.deepEqual({ x: model.player.x, y: model.player.y }, { x: 8, y: 4 });
    const teleported = moved.events.find(({ type }) => type === 'teleported');
    assert.deepEqual(teleported.from, { x: 0, y: 0 });
    assert.deepEqual(teleported.to, { x: 8, y: 7 });
    assert.equal(teleported.remainingMoves, 3);
});

test('피해·이동력 감소·불안정도 증감 이벤트 타일을 적용한다', () => {
    const damageModel = createModel();
    seedState(damageModel, (state) => {
        state.player.x = 1;
        state.player.y = 2;
    });
    const damageMove = damageModel.commitPath([{ x: 1, y: 2 }, { x: 0, y: 2 }]);
    assert.equal(damageMove.ok, true);
    assert.equal(damageModel.player.hp, 88);
    assert.equal(
        damageMove.events.find(({ type }) => type === 'event-tile-triggered').eventType,
        'damage'
    );
    assert.equal(damageMove.events.find(({ type }) => type === 'player-damaged').amount, 12);

    const penaltyModel = createModel();
    seedState(penaltyModel, (state) => {
        state.player.x = 3;
        state.player.y = 5;
    });
    const overBudget = penaltyModel.previewPath([
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
        { x: 0, y: 5 }
    ]);
    assert.equal(overBudget.reason, 'path-cost-exceeded');
    const penaltyMove = penaltyModel.commitPath([
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 }
    ]);
    assert.equal(penaltyMove.ok, true);
    assert.equal(penaltyMove.stepsUsed, 2);
    assert.equal(penaltyMove.remainingMoves, 0);

    const increaseModel = createModel();
    seedState(increaseModel, (state) => {
        state.player.x = 5;
        state.player.y = 3;
    });
    const increaseMove = increaseModel.commitPath([{ x: 5, y: 3 }, { x: 6, y: 3 }]);
    assert.equal(increaseModel.lora.instability, 80);
    assert.equal(
        increaseMove.events.find(({ type }) => type === 'instability-changed').change,
        10
    );

    const decreaseModel = createModel();
    seedState(decreaseModel, (state) => {
        state.floorIndex = 1;
        state.player.x = 1;
        state.player.y = 1;
    });
    const decreaseMove = decreaseModel.commitPath([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    assert.equal(decreaseModel.lora.instability, 60);
    assert.equal(
        decreaseMove.events.find(({ type }) => type === 'instability-changed').change,
        -10
    );
});

test('로라 연속 공격의 불안정도 증가량은 10, 14, 18 순서다', () => {
    const config = cloneGameData();
    config.ACTORS.LORA.MAX_HP = 1000;
    config.ACTORS.LORA.START_INSTABILITY = 0;
    const model = createModel('mascot-costume', config);
    const increases = [];

    for (let attackIndex = 0; attackIndex < 3; attackIndex++) {
        const path = attackIndex === 0
            ? [{ x: 4, y: 4 }, { x: 4, y: 3 }, { x: 4, y: 2 }]
            : [{ x: 4, y: 2 }];
        assert.equal(model.commitPath(path).ok, true);
        const attacked = model.attack('lora', { weapon: 'melee' });
        assert.equal(attacked.ok, true);
        increases.push(attacked.instabilityChange);
        if (attackIndex < 2) {
            assert.equal(model.completeLoraTurn().ok, true);
        }
    }

    assert.deepEqual(increases, [10, 14, 18]);
    assert.equal(model.getSnapshot().consecutiveAttackCount, 3);
});

test('헤이스트 획득 직후 한 턴에 행동 두 번을 충전한다', () => {
    const model = createModel();
    seedState(model, (state) => {
        state.floorIndex = 1;
        state.player.x = 8;
        state.player.y = 7;
    });

    const moved = model.commitPath([{ x: 8, y: 7 }, { x: 7, y: 7 }]);
    assert.equal(moved.ok, true);
    assert.ok(moved.events.some(({ type, itemId }) => type === 'item-picked' && itemId === 'haste'));
    assert.equal(model.getSnapshot().actionsPerTurn, 2);
    assert.equal(model.getSnapshot().actionsRemaining, 2);

    assert.equal(model.heal().ok, true);
    assert.equal(model.getSnapshot().actionsRemaining, 1);
    assert.equal(model.getSnapshot().turn, 'player');
    assert.equal(model.heal().ok, true);
    assert.equal(model.getSnapshot().actionsRemaining, 0);
    assert.equal(model.getSnapshot().turn, 'lora');
});

test('거울은 로라 행동 없이 이동부터 다시 하는 플레이어 추가 턴을 준다', () => {
    const model = createModel();
    seedState(model, (state) => {
        state.floorIndex = 1;
        state.player.x = 4;
        state.player.y = 4;
    });

    assert.equal(model.commitPath([{ x: 4, y: 4 }, { x: 4, y: 5 }]).ok, true);
    const used = model.useItem('mirror');
    assert.equal(used.ok, true);
    assert.ok(used.events.some(({ type }) => type === 'extra-player-turn'));
    assert.ok(used.events.some(({ type, bonus }) => type === 'player-turn-started' && bonus));

    const snapshot = model.getSnapshot();
    assert.equal(snapshot.turn, 'player');
    assert.equal(snapshot.phase, 'move');
    assert.equal(snapshot.playerTurnSerial, 2);
    assert.equal(snapshot.loraActionsCompleted, 0);
    assert.equal(snapshot.extraPlayerTurns, 0);
    assert.equal(snapshot.movementUsed, false);
});

test('오카리나는 공격과 활 패시브의 불안정도 증가를 모두 무효화한다', () => {
    const model = createModel('bow');
    seedState(model, (state) => {
        state.player.x = 7;
        state.player.y = 0;
    });

    const moved = model.commitPath([{ x: 7, y: 0 }, { x: 8, y: 0 }]);
    assert.ok(moved.events.some(({ type, itemId }) => type === 'item-picked' && itemId === 'ocarina'));
    const attacked = model.attack('lora', { weapon: 'bow' });
    assert.equal(attacked.ok, true);
    assert.equal(attacked.instabilityChange, 0);
    assert.equal(model.lora.instability, 70);
    const attackInstability = attacked.events.find(({ type, source }) => (
        type === 'instability-changed' && source === 'player-attack'
    ));
    assert.ok(attackInstability);
    assert.equal(attackInstability.requestedChange, 10);
    assert.equal(attackInstability.change, 0);
    assert.equal(attackInstability.suppressed, true);

    const loraAction = model.performLoraTurn();
    assert.equal(loraAction.ok, true);
    const bowPassive = loraAction.events.find(({ type, source }) => (
        type === 'instability-changed' && source === 'bow-passive'
    ));
    assert.equal(bowPassive.requestedChange, 3);
    assert.equal(bowPassive.change, 0);
    assert.equal(bowPassive.suppressed, true);
    assert.equal(model.lora.instability, 70);
});

test('낡은 곰인형은 한 번만 안정시키고 사용 뒤 공격·방어 페널티를 남기지 않는다', () => {
    const config = cloneGameData();
    config.ACTORS.LORA.MAX_HP = 500;
    for (const state of config.ACTORS.LORA.INSTABILITY_STATES) {
        state.meleeDamage = 40;
        state.areaDamage = 20;
    }

    const createTeddyScenario = () => {
        const model = createModel('bow', config);
        seedState(model, (state) => {
            state.player.x = 4;
            state.player.y = 2;
            state.inventory.set('old-teddy', 1);
            state.inventory.set('haste', 1);
            state.actionsPerTurn = 2;
            state.actionUsed = false;
        });
        assert.equal(model.commitPath([{ x: 4, y: 2 }]).ok, true);
        return model;
    };

    const beforeUse = createTeddyScenario();
    assert.equal(beforeUse.attack('lora', { weapon: 'melee' }).damage, 30);
    assert.equal(beforeUse.heal().ok, true);
    assert.equal(beforeUse.performLoraTurn().damage, 35);

    const afterUse = createTeddyScenario();
    const used = afterUse.useItem('old-teddy');
    assert.equal(used.ok, true);
    assert.equal(used.effects[0].instabilityChange, -20);
    assert.equal(afterUse.lora.instability, 50);
    assert.equal(
        afterUse.getSnapshot().inventory.some(({ itemId }) => itemId === 'old-teddy'),
        false
    );

    const secondUse = afterUse.useItem('old-teddy');
    assert.equal(secondUse.ok, false);
    assert.equal(secondUse.reason, 'item-not-owned');
    assert.equal(afterUse.lora.instability, 50);

    const afterUseCheckpoint = afterUse.createCheckpoint();
    assert.equal(afterUse.attack('lora', { weapon: 'melee' }).damage, 50);
    assert.equal(afterUse.performLoraTurn().damage, 45);

    const restored = afterUse.restoreCheckpoint(afterUseCheckpoint);
    assert.equal(restored.usedItems.includes('old-teddy'), true);
    assert.equal(restored.inventory.some(({ itemId }) => itemId === 'old-teddy'), false);
    assert.equal(restored.lora.instability, 50);
    assert.equal(restored.actionsRemaining, 1);
    assert.equal(afterUse.attack('lora', { weapon: 'melee' }).damage, 50);
});

test('reset은 활과 인형탈 스타터를 각각 독립된 새 플레이로 초기화한다', () => {
    const model = createModel('bow');
    seedState(model, (state) => {
        state.inventory.set('old-teddy', 1);
        state.usedItems.add('old-teddy');
        state.player.hp = 37;
    });

    const mascotReset = model.reset({ starterItemId: 'mascot-costume' });
    assert.deepEqual(mascotReset.inventory, [{ itemId: 'mascot-costume', count: 1 }]);
    assert.deepEqual(mascotReset.usedItems, []);
    assert.equal(mascotReset.player.hp, 100);

    const bowReset = model.reset({ starterItemId: 'bow' });
    assert.deepEqual(bowReset.inventory, [{ itemId: 'bow', count: 1 }]);
    assert.deepEqual(bowReset.usedItems, []);
    assert.equal(bowReset.player.hp, 100);
});

test('버섯은 이동력과 근접 공격력을 두 배로 하고 피해를 받으면 종료된다', () => {
    const config = cloneGameData();
    config.ACTORS.LORA.MAX_HP = 500;
    const model = createModel('mascot-costume', config);
    seedState(model, (state) => {
        state.floorIndex = 1;
        state.player.x = 0;
        state.player.y = 3;
        state.inventory.set('haste', 1);
        state.lora.peaceTurns = 1;
    });

    assert.equal(model.commitPath([{ x: 0, y: 3 }, { x: 0, y: 2 }]).ok, true);
    assert.equal(model.getSnapshot().actionsPerTurn, 2);
    assert.equal(model.useItem('mushroom').ok, true);
    assert.equal(model.player.mushroomActive, true);
    assert.equal(model.heal().ok, true);
    assert.equal(model.completeLoraTurn().ok, true);
    assert.equal(model.player.mushroomActive, true);

    const movePreview = model.previewPath([{ x: 0, y: 2 }]);
    assert.equal(movePreview.moveRange, 8);
    const moved = model.commitPath([
        { x: 0, y: 2 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 }
    ]);
    assert.equal(moved.ok, true);
    assert.equal(moved.moveRange, 8);

    const attacked = model.attack('lora', { weapon: 'melee' });
    assert.equal(attacked.ok, true);
    assert.equal(attacked.damage, 100);
    assert.equal(model.heal().ok, true);
    const completed = model.completeLoraTurn();
    assert.equal(completed.ok, true);
    assert.ok(completed.events.some(({ type }) => type === 'mushroom-ended'));
    assert.equal(model.player.mushroomActive, false);
});

test('사거리 안의 몹은 공격하고 사망 시 정화제를 드롭한다', () => {
    const model = createModel();
    seedState(model, (state) => {
        state.player.x = 0;
        state.player.y = 5;
    });

    assert.equal(model.commitPath([{ x: 0, y: 5 }]).ok, true);
    const firstAttack = model.attack('f1-mob', { weapon: 'melee' });
    assert.equal(firstAttack.ok, true);
    assert.equal(firstAttack.damage, 50);
    assert.equal(firstAttack.defeated, false);
    const firstEnemyCycle = model.completeLoraTurn();
    assert.deepEqual(firstEnemyCycle.mobAttacks, [{ mobId: 'f1-mob', damage: 12 }]);
    assert.equal(model.player.hp, 76);

    assert.equal(model.commitPath([{ x: 0, y: 5 }]).ok, true);
    const secondAttack = model.attack('f1-mob', { weapon: 'melee' });
    assert.equal(secondAttack.defeated, true);
    assert.ok(secondAttack.events.some(({ type }) => type === 'mob-defeated'));
    assert.ok(secondAttack.events.some(({ type, itemId }) => (
        type === 'item-dropped' && itemId === 'tile-cleanser'
    )));
    assert.ok(model.getCurrentFloorState().items.some(({ id, collected }) => (
        id === 'drop-f1-mob' && !collected
    )));

    assert.equal(model.completeLoraTurn().ok, true);
    const pickup = model.commitPath([{ x: 0, y: 5 }, { x: 0, y: 6 }, { x: 0, y: 7 }]);
    assert.equal(pickup.ok, true);
    assert.ok(pickup.events.some(({ type, itemId }) => (
        type === 'item-picked' && itemId === 'tile-cleanser'
    )));
    assert.ok(model.getSnapshot().inventory.some(({ itemId, count }) => (
        itemId === 'tile-cleanser' && count === 1
    )));
});

test('6번째 로라 행동 직후 지하층으로 전환하고 12번째 행동에서 실패한다', () => {
    const model = createModel();
    let completed;
    for (let loraAction = 1; loraAction <= 6; loraAction++) {
        completed = completeQuietCycle(model);
        assert.equal(model.getSnapshot().loraActionsCompleted, loraAction);
        assert.equal(model.getSnapshot().result, null);
    }

    assert.equal(completed.floorTransitioned, true);
    assert.ok(completed.events.some(({ type, floorIndex }) => (
        type === 'floor-transition' && floorIndex === 1
    )));
    assert.equal(model.getSnapshot().floorIndex, 1);
    assert.equal(model.getSnapshot().floor.id, 'basement');
    assert.equal(model.getSnapshot().turnNumber, 7);

    for (let loraAction = 7; loraAction <= 11; loraAction++) {
        completed = completeQuietCycle(model);
        assert.equal(model.getSnapshot().loraActionsCompleted, loraAction);
        assert.equal(model.getSnapshot().result, null);
    }
    completed = completeQuietCycle(model);
    assert.equal(completed.result.outcome, 'failure');
    assert.equal(completed.result.reason, 'turn-limit');
    assert.equal(completed.result.loraActionsCompleted, 12);
    assert.equal(model.getSnapshot().turn, 'result');
    assert.equal(model.getSnapshot().turnNumber, 12);
});

test('체크포인트는 인벤토리·필드·행동 상태를 독립 복제하고 정확히 복원한다', () => {
    const model = createModel('bow');
    seedState(model, (state) => {
        state.player.x = 7;
        state.player.y = 0;
    });
    assert.equal(model.commitPath([{ x: 7, y: 0 }, { x: 8, y: 0 }]).ok, true);

    const expected = model.getSnapshot();
    const checkpoint = model.createCheckpoint();
    assert.equal(model.attack('lora', { weapon: 'bow' }).ok, true);
    assert.equal(model.completeLoraTurn().ok, true);
    assert.notDeepEqual(model.getSnapshot(), expected);

    const restored = model.restoreCheckpoint(checkpoint);
    assert.deepEqual(restored, expected);
    assert.deepEqual(model.getSnapshot(), expected);

    checkpoint.state.player.hp = 1;
    checkpoint.state.inventory.clear();
    restored.player.hp = 2;
    restored.inventory.length = 0;
    assert.equal(model.getSnapshot().player.hp, expected.player.hp);
    assert.deepEqual(model.getSnapshot().inventory, expected.inventory);
});

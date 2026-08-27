import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TutorialBattleModel } from '../project/engine/script/scene/tutorial/_tutorial_battle_model.js';

/** @returns {object} 수정 가능한 튜토리얼 설정 복제본입니다. */
function cloneGameData() {
    return JSON.parse(JSON.stringify(TUTORIAL_GAME_DATA));
}

/** @param {string} [starterItemId='mascot-costume'] @param {object} [config=TUTORIAL_GAME_DATA] */
function createModel(starterItemId = 'mascot-costume', config = TUTORIAL_GAME_DATA) {
    const model = new TutorialBattleModel(config);
    if (starterItemId !== 'mascot-costume') {
        model.reset({ starterItemId });
    }
    return model;
}

/** @param {TutorialBattleModel} model @param {(state:object)=>void} mutate */
function seedState(model, mutate) {
    const checkpoint = model.createCheckpoint();
    mutate(checkpoint.state);
    model.restoreCheckpoint(checkpoint);
}

/** @param {TutorialBattleModel} model @param {(state:object)=>void} [mutate] */
function seedActionState(model, mutate = () => {}) {
    seedState(model, (state) => {
        state.turn = 'player';
        state.phase = 'action';
        state.result = null;
        state.movementUsed = true;
        state.actionsUsed = 0;
        state.actionsPerTurn = 1;
        state.actionUsed = false;
        state.loraTurnPerformed = false;
        mutate(state);
    });
}

/** @param {TutorialBattleModel} model @param {(state:object)=>void} [mutate] */
function seedLoraState(model, mutate = () => {}) {
    seedState(model, (state) => {
        state.turn = 'lora';
        state.phase = 'lora';
        state.result = null;
        state.loraTurnPerformed = false;
        mutate(state);
    });
}

/**
 * 미리보기 호출이 스냅샷과 체크포인트를 변경하지 않는지 확인합니다.
 * @param {TutorialBattleModel} model
 * @param {()=>object} previewCall
 * @returns {object}
 */
function assertPurePreview(model, previewCall) {
    const snapshotBefore = model.getSnapshot();
    const checkpointBefore = model.createCheckpoint();
    const preview = previewCall();
    assert.deepEqual(model.getSnapshot(), snapshotBefore);
    assert.deepEqual(model.createCheckpoint(), checkpointBefore);
    return preview;
}

/** @param {TutorialBattleModel} model @param {string|null} [targetId=null] */
function projectActionState(model, targetId = null) {
    const snapshot = model.getSnapshot();
    const target = snapshot.floor.mobs.find(({ id }) => id === targetId);
    return {
        turn: snapshot.turn,
        phase: snapshot.phase,
        playerHp: snapshot.player.hp,
        loraHp: snapshot.lora.hp,
        instability: snapshot.lora.instability,
        playerAlive: snapshot.player.alive,
        loraAlive: snapshot.lora.alive,
        mushroomActive: snapshot.player.mushroomActive,
        peaceTurns: snapshot.lora.peaceTurns,
        actionsUsed: snapshot.actionsUsed,
        actionsPerTurn: snapshot.actionsPerTurn,
        actionsRemaining: snapshot.actionsRemaining,
        extraPlayerTurns: snapshot.extraPlayerTurns,
        playerTurnSerial: snapshot.playerTurnSerial,
        consecutiveAttackCount: snapshot.consecutiveAttackCount,
        targetHp: target?.hp ?? (targetId === 'lora' ? snapshot.lora.hp : null),
        inventory: snapshot.inventory,
        usedItems: snapshot.usedItems,
        result: snapshot.result
    };
}

/**
 * 비변이 미리보기와 실제 행동 후 핵심 상태가 같은지 비교합니다.
 * @param {TutorialBattleModel} model
 * @param {string} action
 * @param {object} options
 * @param {()=>object} perform
 * @returns {{preview:object,actual:object}}
 */
function comparePreviewWithActual(model, action, options, perform) {
    const preview = assertPurePreview(
        model,
        () => model.previewPlayerAction(action, options)
    );
    assert.equal(preview.ok, true);
    assert.deepEqual(preview.before, projectActionState(model, preview.targetId ?? null));
    const actual = perform();
    assert.equal(actual.ok, true);
    assert.deepEqual(
        projectActionState(model, preview.targetId ?? null),
        preview.expected
    );
    return { preview, actual };
}

test('플레이어 행동 미리보기 목록은 공격·회복·사용 가능한 아이템·대기를 비변이로 제공한다', () => {
    const config = cloneGameData();
    config.ACTORS.LORA.MAX_HP = 500;
    const model = createModel('bow', config);
    seedActionState(model, (state) => {
        state.player.x = 4;
        state.player.y = 2;
        state.lora.x = 4;
        state.lora.y = 4;
        for (const itemId of [
            'old-teddy',
            'music-box',
            'eyeliner',
            'mirror',
            'mushroom',
            'memory-photo',
            'tile-cleanser',
            'ocarina'
        ]) {
            state.inventory.set(itemId, 1);
        }
    });

    const previews = assertPurePreview(model, () => model.getPlayerActionPreviews());
    assert.deepEqual(Object.keys(previews.attack), ['melee', 'bow']);
    assert.ok(previews.attack.melee.some(({ targetId }) => targetId === 'lora'));
    assert.ok(previews.attack.bow.some(({ targetId }) => targetId === 'lora'));
    assert.equal(previews.heal.action, 'heal');
    assert.equal(previews.wait.action, 'wait');
    assert.deepEqual(
        previews.items.map(({ itemId }) => itemId).sort(),
        ['eyeliner', 'memory-photo', 'mirror', 'mushroom', 'music-box', 'old-teddy']
    );
});

test('활 원거리 공격과 회복·대기의 예상 상태는 실제 행동 결과와 같다', () => {
    const config = cloneGameData();
    config.ACTORS.LORA.MAX_HP = 500;

    const bowModel = createModel('bow', config);
    seedActionState(bowModel, (state) => {
        state.player.x = 0;
        state.player.y = 0;
        state.lora.x = 8;
        state.lora.y = 7;
    });
    const bow = comparePreviewWithActual(
        bowModel,
        'attack',
        { targetId: 'lora', weapon: 'bow' },
        () => bowModel.attack('lora', { weapon: 'bow' })
    );
    assert.equal(bow.preview.rawDamage, 30);
    assert.equal(bow.preview.finalDamage, bow.actual.damage);

    const healModel = createModel('mascot-costume', config);
    seedActionState(healModel, (state) => {
        state.player.hp = 50;
        state.player.alive = true;
    });
    const heal = comparePreviewWithActual(healModel, 'heal', {}, () => healModel.heal());
    assert.equal(heal.preview.expected.playerHp, 70);
    assert.equal(heal.actual.amount, 20);

    const waitModel = createModel('bow', config);
    seedActionState(waitModel);
    comparePreviewWithActual(waitModel, 'wait', {}, () => waitModel.wait());
});

test('낡은 곰인형 사용 전후와 버섯 활성 공격이 실제 피해 계산과 같다', () => {
    const config = cloneGameData();
    config.ACTORS.LORA.MAX_HP = 500;
    const createTeddyModel = () => {
        const model = createModel('bow', config);
        seedActionState(model, (state) => {
            state.player.x = 4;
            state.player.y = 2;
            state.lora.x = 4;
            state.lora.y = 4;
            state.inventory.set('old-teddy', 1);
            state.inventory.set('haste', 1);
            state.actionsPerTurn = 2;
        });
        return model;
    };

    const beforeUse = createTeddyModel();
    const before = comparePreviewWithActual(
        beforeUse,
        'attack',
        { targetId: 'lora', weapon: 'melee' },
        () => beforeUse.attack('lora', { weapon: 'melee' })
    );
    assert.equal(before.preview.attackDamagePenalty, 20);
    assert.equal(before.actual.damage, 30);

    const afterUse = createTeddyModel();
    const teddy = comparePreviewWithActual(
        afterUse,
        'use-item',
        { itemId: 'old-teddy' },
        () => afterUse.useItem('old-teddy')
    );
    assert.equal(teddy.preview.consumedItemCount, 1);
    assert.equal(teddy.preview.changes.instability, -30);
    const after = comparePreviewWithActual(
        afterUse,
        'attack',
        { targetId: 'lora', weapon: 'melee' },
        () => afterUse.attack('lora', { weapon: 'melee' })
    );
    assert.equal(after.preview.attackDamagePenalty, 0);
    assert.equal(after.actual.damage, 50);

    const mushroomModel = createModel('bow', config);
    seedActionState(mushroomModel, (state) => {
        state.player.x = 4;
        state.player.y = 2;
        state.lora.x = 4;
        state.lora.y = 4;
        state.inventory.set('mushroom', 1);
        state.inventory.set('haste', 1);
        state.actionsPerTurn = 2;
    });
    const mushroom = comparePreviewWithActual(
        mushroomModel,
        'use-item',
        { itemId: 'mushroom' },
        () => mushroomModel.useItem('mushroom')
    );
    assert.equal(mushroom.preview.expected.mushroomActive, true);
    const boosted = comparePreviewWithActual(
        mushroomModel,
        'attack',
        { targetId: 'lora', weapon: 'melee' },
        () => mushroomModel.attack('lora', { weapon: 'melee' })
    );
    assert.equal(boosted.preview.attackMultiplier, 2);
    assert.equal(boosted.actual.damage, 100);
});

test('오르골 평화와 인형탈 방어를 포함한 로라 의도는 실제 로라 행동과 같다', () => {
    const musicModel = createModel('mascot-costume');
    seedActionState(musicModel, (state) => {
        state.inventory.set('music-box', 1);
    });
    comparePreviewWithActual(
        musicModel,
        'use-item',
        { itemId: 'music-box' },
        () => musicModel.useItem('music-box')
    );
    const peaceIntent = assertPurePreview(musicModel, () => musicModel.getLoraIntent());
    assert.equal(peaceIntent.reason, 'peace-active');
    assert.equal(peaceIntent.actionType, 'none');
    const peaceActual = musicModel.performLoraTurn();
    assert.equal(peaceActual.action, peaceIntent.executionAction);
    assert.equal(musicModel.lora.instability, peaceIntent.expectedInstability);
    assert.equal(peaceActual.damage, peaceIntent.finalDamage);

    const mascotModel = createModel('mascot-costume');
    seedLoraState(mascotModel, (state) => {
        state.player.x = 4;
        state.player.y = 2;
        state.lora.x = 4;
        state.lora.y = 4;
        state.lora.instability = 70;
    });
    const mascotIntent = assertPurePreview(mascotModel, () => mascotModel.getLoraIntent());
    assert.equal(mascotIntent.rawDamage, 40);
    assert.equal(mascotIntent.damageReduction, 10);
    assert.equal(mascotIntent.finalDamage, 30);
    const mascotActual = mascotModel.performLoraTurn();
    assert.equal(mascotActual.damage, mascotIntent.finalDamage);
    assert.equal(mascotModel.player.hp, mascotIntent.playerHpAfter);
});

test('활 패시브와 로라의 다섯 불안정 상태가 같은 의도 계산으로 실제 행동을 결정한다', () => {
    const bowModel = createModel('bow');
    seedLoraState(bowModel, (state) => {
        state.player.x = 4;
        state.player.y = 2;
        state.lora.x = 4;
        state.lora.y = 4;
        state.lora.instability = 39;
    });
    const bowIntent = assertPurePreview(bowModel, () => bowModel.getLoraIntent());
    assert.equal(bowIntent.currentStateId, 'anxious');
    assert.equal(bowIntent.stateId, 'shaken');
    assert.equal(bowIntent.rawDamage, 25);
    assert.equal(bowIntent.passiveDamageBonus, 5);
    assert.equal(bowIntent.passiveAdjustedDamage, 30);
    const bowActual = bowModel.performLoraTurn();
    assert.equal(bowActual.damage, bowIntent.finalDamage);
    assert.equal(bowModel.lora.instability, bowIntent.expectedInstability);

    const cases = [
        { id: 'stable', instability: 5, rawDamage: 0, action: 'idle' },
        { id: 'anxious', instability: 20, rawDamage: 15, action: 'melee' },
        { id: 'shaken', instability: 50, rawDamage: 15, action: 'area' },
        { id: 'unstable', instability: 70, rawDamage: 40, action: 'melee' },
        { id: 'collapse', instability: 90, rawDamage: 35, action: 'area' }
    ];
    for (const entry of cases) {
        const model = createModel('mascot-costume');
        seedLoraState(model, (state) => {
            state.inventory.clear();
            state.player.x = 4;
            state.player.y = 2;
            state.lora.x = entry.action === 'area' ? 8 : 4;
            state.lora.y = entry.action === 'area' ? 7 : 4;
            state.lora.instability = entry.instability;
        });
        const intent = assertPurePreview(model, () => model.getLoraIntent());
        assert.equal(intent.stateId, entry.id);
        assert.equal(intent.rawDamage, entry.rawDamage);
        assert.equal(intent.executionAction, entry.action);
        assert.equal(intent.affectsAll, entry.action === 'area');
        assert.equal(intent.affectedTiles.length, entry.action === 'melee' ? 1 : 0);
        const actual = model.performLoraTurn();
        assert.equal(actual.action, intent.executionAction);
        assert.equal(actual.damage, intent.finalDamage);
        assert.equal(model.player.hp, intent.playerHpAfter);
        assert.equal(model.lora.instability, intent.expectedInstability);
    }
});

test('잘못된 단계·대상·아이템의 미리보기와 실제 행동은 같은 reason ID를 쓴다', () => {
    const phaseModel = createModel();
    const phasePreview = assertPurePreview(
        phaseModel,
        () => phaseModel.previewPlayerAction('attack', { targetId: 'lora' })
    );
    assert.equal(phasePreview.reason, phaseModel.attack('lora').reason);

    const targetModel = createModel();
    seedActionState(targetModel);
    const targetPreview = assertPurePreview(
        targetModel,
        () => targetModel.previewPlayerAction('attack', { targetId: 'missing-target' })
    );
    assert.equal(targetPreview.reason, targetModel.attack('missing-target').reason);

    const itemModel = createModel();
    seedActionState(itemModel);
    const itemPreview = assertPurePreview(
        itemModel,
        () => itemModel.previewPlayerAction('use-item', { itemId: 'music-box' })
    );
    assert.equal(itemPreview.reason, itemModel.useItem('music-box').reason);
});

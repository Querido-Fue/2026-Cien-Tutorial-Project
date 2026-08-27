import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TUTORIAL_EFFECT_TRIGGERS } from '../project/engine/script/scene/tutorial/_tutorial_effect_contract.js';
import { TutorialEffectExecutor } from '../project/engine/script/scene/tutorial/_tutorial_effect_executor.js';

/** @returns {object} 동결된 게임 데이터의 수정 가능한 복제본입니다. */
function cloneGameData() {
    return JSON.parse(JSON.stringify(TUTORIAL_GAME_DATA));
}

/** @param {object} [data=TUTORIAL_GAME_DATA] @returns {TutorialEffectExecutor} 효과 실행기입니다. */
function createExecutor(data = TUTORIAL_GAME_DATA) {
    return new TutorialEffectExecutor({
        items: data.ITEMS,
        eventTileEffects: data.EVENT_TILE_EFFECTS
    });
}

test('효과 계약·레지스트리·실행기는 파일별 단일 책임과 단방향 의존성을 유지한다', async () => {
    const modules = [
        ['contract', new URL('../project/engine/script/scene/tutorial/_tutorial_effect_contract.js', import.meta.url), 0],
        ['registry', new URL('../project/engine/script/scene/tutorial/_tutorial_effect_registry.js', import.meta.url), 1],
        ['executor', new URL('../project/engine/script/scene/tutorial/_tutorial_effect_executor.js', import.meta.url), 1]
    ];
    for (const [label, url, expectedClassCount] of modules) {
        const source = await readFile(url, 'utf8');
        assert.equal(
            (source.match(/^\s*(?:export\s+)?class\s+/gm) || []).length,
            expectedClassCount,
            label
        );
        assert.doesNotMatch(source, /_tutorial_(?:scene|battle_model)\.js/, label);
    }
});

/**
 * 효과 조건을 만족하는 명시적 실행 context를 만듭니다.
 * @param {object} effect - 검사할 선언형 효과입니다.
 * @param {string} itemId - 효과 원본 아이템입니다.
 * @returns {object} preview/apply 공통 context입니다.
 */
function createEffectContext(effect, itemId) {
    const conditions = new Set(effect.conditions || []);
    return {
        itemIds: [itemId],
        actor: conditions.has('actor-lora') ? 'lora' : 'player',
        target: 'player',
        weapon: conditions.has('weapon-bow') ? 'bow' : 'melee',
        baseDamage: 40,
        playerHp: 100,
        instability: 70,
        maxInstability: 100,
        requestedInstabilityChange: 10,
        peaceTurns: conditions.has('peace-active') ? 2 : 0,
        peaceActive: conditions.has('peace-active'),
        extraPlayerTurns: 0,
        mushroomActive: itemId === 'mushroom',
        baseMoveRange: 4,
        remainingMoves: 4,
        baseActionsPerTurn: 1,
        eventTileType: conditions.has('negative-event-tile') ? 'damage' : null
    };
}

test('모든 현재 아이템과 네 이벤트 타일이 안정 ID의 effects 배열을 사용한다', () => {
    const expectedItemIds = [
        'bow',
        'mascot-costume',
        'old-teddy',
        'music-box',
        'eyeliner',
        'diamond-pickaxe',
        'mirror',
        'mushroom',
        'ocarina',
        'haste',
        'memory-photo',
        'tile-cleanser'
    ];
    assert.deepEqual(Object.keys(TUTORIAL_GAME_DATA.ITEMS), expectedItemIds);
    for (const item of Object.values(TUTORIAL_GAME_DATA.ITEMS)) {
        assert.ok(Array.isArray(item.effects));
        assert.ok(item.effects.length > 0);
        assert.equal('effect' in item, false);
        assert.equal(new Set(item.effects.map(({ id }) => id)).size, item.effects.length);
    }
    assert.deepEqual(Object.keys(TUTORIAL_GAME_DATA.EVENT_TILE_EFFECTS), [
        'damage',
        'move-penalty',
        'instability-up',
        'instability-down'
    ]);
});

test('모든 아이템 효과는 preview/apply에서 같은 operation 순서와 상태를 만든다', () => {
    const executor = createExecutor();
    for (const [itemId, item] of Object.entries(TUTORIAL_GAME_DATA.ITEMS)) {
        for (const effect of item.effects) {
            const context = createEffectContext(effect, itemId);
            const preview = executor.executeItem(
                itemId,
                effect.trigger,
                context,
                { mode: 'preview' }
            );
            const apply = executor.executeItem(
                itemId,
                effect.trigger,
                context,
                { mode: 'apply' }
            );
            assert.deepEqual(apply.state, preview.state, effect.id);
            assert.deepEqual(apply.operations, preview.operations, effect.id);
            assert.ok(
                preview.operations.some(({ effectId }) => effectId === effect.id),
                effect.id
            );
        }
    }
});

test('공격 효과는 데이터 order에 따라 원거리 설정→감산→배율 순서로 계산된다', () => {
    const executor = createExecutor();
    const context = {
        itemIds: ['mushroom', 'old-teddy', 'bow'],
        actor: 'player',
        weapon: 'bow',
        baseDamage: 0,
        mushroomActive: true
    };
    const preview = executor.executeOwned(
        context.itemIds,
        TUTORIAL_EFFECT_TRIGGERS.ATTACK,
        context,
        { mode: 'preview' }
    );
    const apply = executor.executeOwned(
        context.itemIds,
        TUTORIAL_EFFECT_TRIGGERS.ATTACK,
        context,
        { mode: 'apply' }
    );
    assert.deepEqual(apply.state, preview.state);
    assert.deepEqual(apply.operations, preview.operations);
    assert.deepEqual(preview.operations.map(({ effectId }) => effectId), [
        'bow-player-ranged-damage',
        'old-teddy-player-attack-penalty',
        'mushroom-player-attack-damage'
    ]);
    assert.equal(preview.state.rawDamage, 30);
    assert.equal(preview.state.flatDamageModifier, -20);
    assert.equal(preview.state.damageMultiplier, 2);
    assert.equal(preview.state.calculatedDamage, 20);
});

test('피해 감소·버섯 종료와 오카리나 억제를 선언형 조건으로 계산한다', () => {
    const executor = createExecutor();
    const damage = executor.calculatePlayerDamage(
        ['mascot-costume', 'old-teddy'],
        { baseDamage: 40, playerHp: 100, mushroomActive: true },
        { mode: 'preview' }
    );
    assert.equal(damage.reduction, 20);
    assert.equal(damage.finalDamage, 20);
    assert.equal(damage.mushroomEnds, true);

    const instability = executor.calculateInstabilityChange(
        ['ocarina'],
        { instability: 70, maxInstability: 100, requestedChange: 10 },
        { mode: 'preview' }
    );
    assert.equal(instability.requestedChange, 10);
    assert.equal(instability.change, 0);
    assert.equal(instability.suppressed, true);
    assert.equal(
        instability.operations[0].effectId,
        'ocarina-suppress-instability-increase'
    );
});

test('네 이벤트 타일도 preview/apply가 같은 operation vocabulary를 사용한다', () => {
    const executor = createExecutor();
    for (const eventType of Object.keys(TUTORIAL_GAME_DATA.EVENT_TILE_EFFECTS)) {
        const context = {
            itemIds: ['mascot-costume'],
            actor: 'player',
            target: 'player',
            playerHp: 100,
            instability: 70,
            maxInstability: 100,
            remainingMoves: 4,
            mushroomActive: false
        };
        const preview = executor.executeEventTile(
            eventType,
            TUTORIAL_EFFECT_TRIGGERS.MOVE_ENTER,
            context,
            { mode: 'preview' }
        );
        const apply = executor.executeEventTile(
            eventType,
            TUTORIAL_EFFECT_TRIGGERS.MOVE_ENTER,
            context,
            { mode: 'apply' }
        );
        assert.deepEqual(apply.state, preview.state, eventType);
        assert.deepEqual(apply.operations, preview.operations, eventType);
        assert.equal(preview.operations.length, 1, eventType);
    }
});

test('알 수 없는 ID·참조와 잘못된 order·횟수 값은 생성 단계에서 실패한다', () => {
    const unknownOperation = cloneGameData();
    unknownOperation.ITEMS.bow.effects[0].operation = 'unknown-operation';
    assert.throws(() => createExecutor(unknownOperation), /알 수 없는 operation/);

    const unknownTrigger = cloneGameData();
    unknownTrigger.ITEMS.bow.effects[0].trigger = 'unknown-trigger';
    assert.throws(() => createExecutor(unknownTrigger), /알 수 없는 trigger/);

    const unknownCondition = cloneGameData();
    unknownCondition.ITEMS.bow.effects[0].conditions = ['unknown-condition'];
    assert.throws(() => createExecutor(unknownCondition), /conditions/);

    const duplicateId = cloneGameData();
    duplicateId.ITEMS.bow.effects[1].id = duplicateId.ITEMS.bow.effects[0].id;
    assert.throws(() => createExecutor(duplicateId), /중복/);

    const invalidOrder = cloneGameData();
    invalidOrder.ITEMS.bow.effects[0].order = -1;
    assert.throws(() => createExecutor(invalidOrder), /order/);

    const invalidCount = cloneGameData();
    invalidCount.ITEMS.haste.effects[0].value = 0.5;
    assert.throws(() => createExecutor(invalidCount), /0 이상의 정수/);

    const unknownEventTileReference = cloneGameData();
    unknownEventTileReference.ITEMS['tile-cleanser'].effects[0].value = 'unknown-event';
    assert.throws(() => createExecutor(unknownEventTileReference), /알 수 없는 이벤트 타일/);
});

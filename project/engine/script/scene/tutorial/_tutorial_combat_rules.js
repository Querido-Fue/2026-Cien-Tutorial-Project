import {
    TUTORIAL_EFFECT_OPERATIONS as EFFECT_OPERATIONS,
    TUTORIAL_EFFECT_TRIGGERS as EFFECT_TRIGGERS
} from './_tutorial_effect_contract.js';

const LORA_ID = 'lora';

/** @param {*} value @param {number} [fallback=0] @returns {number} 유한 숫자입니다. */
function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/** @param {*} value @returns {{x:number,y:number}|null} 유효한 타일 복제본입니다. */
function cloneTile(value) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
}

const LEGACY_EFFECT_RESULT_BUILDERS = Object.freeze({
    [EFFECT_OPERATIONS.CHANGE_INSTABILITY_FLAT]: (operation) => ({
        type: 'stabilize',
        instabilityChange: operation.instabilityCalculation?.change ?? 0
    }),
    [EFFECT_OPERATIONS.SCALE_INSTABILITY_CURRENT]: (operation) => ({
        type: 'stabilize',
        instabilityChange: operation.instabilityCalculation?.change ?? 0
    }),
    [EFFECT_OPERATIONS.SET_PEACE_TURNS_MIN]: (operation) => ({
        type: 'peace',
        durationLoraTurns: operation.peaceTurnsAfter ?? 0
    }),
    [EFFECT_OPERATIONS.ADD_EXTRA_PLAYER_TURNS]: (operation) => ({
        type: 'extra-player-turn',
        count: operation.extraPlayerTurnsAdded ?? 0
    }),
    [EFFECT_OPERATIONS.SET_MUSHROOM_ACTIVE]: () => ({ type: 'mushroom' }),
    [EFFECT_OPERATIONS.REPLACE_EVENT_TILE_TYPE]: (operation) => ({
        type: 'event-tile-replaced',
        beforeType: operation.beforeType,
        afterType: operation.afterType
    })
});

/**
 * @class TutorialCombatRules
 * @description 플레이어 전투 행동에 공통으로 쓰는 검증과 원자적 수치 계산을 제공합니다.
 */
export class TutorialCombatRules {
    #items;
    #player;
    #effects;

    /** @param {object} config - 모델이 검증한 아이템·플레이어 설정입니다. */
    constructor(config = {}) {
        this.#items = Object.freeze({ ...(config.items || {}) });
        this.#player = Object.freeze({ ...(config.player || {}) });
        this.#effects = config.effectExecutor;
        if (!this.#effects) {
            throw new TypeError('TutorialCombatRules: effectExecutor가 필요합니다.');
        }
    }

    /** @param {string} itemId @returns {boolean} 자동 적용 아이템 여부입니다. */
    isPassiveItem(itemId) {
        return this.#effects.isAutomaticItem(itemId);
    }

    /**
     * 외부 전투 상태를 계산 전용 독립 상태로 정규화합니다.
     * @param {object} state - 모델이 제공한 읽기 전용 전투 상태입니다.
     * @returns {object} Map과 Set까지 복제한 계산 상태입니다.
     */
    createDraft(state = {}) {
        const inventory = state.inventory instanceof Map
            ? new Map(state.inventory)
            : new Map((Array.isArray(state.inventory) ? state.inventory : []).map((entry) => (
                Array.isArray(entry)
                    ? [entry[0], toFiniteNumber(entry[1])]
                    : [entry?.itemId, toFiniteNumber(entry?.count)]
            )).filter(([itemId]) => typeof itemId === 'string'));
        const usedItems = state.usedItems instanceof Set
            ? new Set(state.usedItems)
            : new Set(Array.isArray(state.usedItems) ? state.usedItems : []);
        return {
            turn: state.turn,
            phase: state.phase,
            result: state.result ? { ...state.result } : null,
            movementUsed: state.movementUsed === true,
            actionsUsed: Math.max(0, Math.floor(toFiniteNumber(state.actionsUsed))),
            actionsPerTurn: Math.max(1, Math.floor(toFiniteNumber(state.actionsPerTurn, 1))),
            extraPlayerTurns: Math.max(0, Math.floor(toFiniteNumber(state.extraPlayerTurns))),
            playerTurnSerial: Math.max(1, Math.floor(toFiniteNumber(state.playerTurnSerial, 1))),
            consecutiveAttackCount: Math.max(
                0,
                Math.floor(toFiniteNumber(state.consecutiveAttackCount))
            ),
            loraTurnPerformed: state.loraTurnPerformed === true,
            player: {
                x: toFiniteNumber(state.player?.x),
                y: toFiniteNumber(state.player?.y),
                hp: Math.max(0, toFiniteNumber(state.player?.hp)),
                maxHp: Math.max(0, toFiniteNumber(state.player?.maxHp)),
                alive: state.player?.alive === true,
                mushroomActive: state.player?.mushroomActive === true
            },
            lora: {
                x: toFiniteNumber(state.lora?.x),
                y: toFiniteNumber(state.lora?.y),
                hp: Math.max(0, toFiniteNumber(state.lora?.hp)),
                maxHp: Math.max(0, toFiniteNumber(state.lora?.maxHp)),
                alive: state.lora?.alive === true,
                instability: this.#clamp(
                    toFiniteNumber(state.lora?.instability),
                    0,
                    Math.max(0, toFiniteNumber(state.lora?.maxInstability, 100))
                ),
                maxInstability: Math.max(
                    0,
                    toFiniteNumber(state.lora?.maxInstability, 100)
                ),
                peaceTurns: Math.max(0, Math.floor(toFiniteNumber(state.lora?.peaceTurns)))
            },
            inventory,
            usedItems,
            mobs: (Array.isArray(state.mobs) ? state.mobs : []).map((mob) => ({
                id: mob.id,
                x: toFiniteNumber(mob.x),
                y: toFiniteNumber(mob.y),
                hp: Math.max(0, toFiniteNumber(mob.hp)),
                maxHp: Math.max(0, toFiniteNumber(mob.maxHp)),
                alive: mob.alive === true,
                dropItemId: mob.dropItemId ?? null
            }))
        };
    }

    /** @param {object} state @returns {boolean} 일반 행동 가능 여부입니다. */
    canUseAction(state) {
        return state.turn === 'player'
            && state.phase === 'action'
            && state.movementUsed
            && state.actionsUsed < state.actionsPerTurn
            && !state.result
            && state.player.alive;
    }

    /** @param {object} state @param {string} itemId @returns {boolean} 보유 여부입니다. */
    hasItem(state, itemId) {
        return (state.inventory.get(itemId) ?? 0) > 0;
    }

    /** @param {object} state @returns {number} 현재 패시브 기준 행동 수입니다. */
    getActionsPerTurn(state) {
        const draft = this.createDraft(state);
        const execution = this.#effects.executeOwned(
            this.#getOwnedItemIds(draft),
            EFFECT_TRIGGERS.TURN_START,
            {
                actor: 'player',
                baseActionsPerTurn: 1,
                mushroomActive: draft.player.mushroomActive,
                peaceTurns: draft.lora.peaceTurns
            },
            { mode: 'preview' }
        );
        return Math.max(1, Math.floor(execution.state.actionsPerTurn));
    }

    /**
     * 현재 지속 효과를 반영한 이동 범위를 반환합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {number} baseMoveRange - 기본 이동 범위입니다.
     * @returns {number} 최종 이동 범위입니다.
     */
    getMoveRange(state, baseMoveRange) {
        const draft = this.createDraft(state);
        const execution = this.#effects.executeOwned(
            this.#getOwnedItemIds(draft),
            EFFECT_TRIGGERS.MOVE_ENTER,
            {
                actor: 'player',
                baseMoveRange: Math.max(0, toFiniteNumber(baseMoveRange)),
                mushroomActive: draft.player.mushroomActive,
                peaceTurns: draft.lora.peaceTurns
            },
            { mode: 'preview' }
        );
        return Math.max(0, execution.state.moveRange);
    }

    /** @param {object} state @returns {boolean} 벽 통과 효과 보유 여부입니다. */
    canTraverseWalls(state) {
        const draft = this.createDraft(state);
        return this.#effects.executeOwned(
            this.#getOwnedItemIds(draft),
            EFFECT_TRIGGERS.MOVE_ENTER,
            {
                actor: 'player',
                mushroomActive: draft.player.mushroomActive,
                peaceTurns: draft.lora.peaceTurns
            },
            { mode: 'preview' }
        ).state.wallTraversal;
    }

    /**
     * 바닥에서 즉시 획득할 아이템이 벽 통과를 제공하는지 확인합니다.
     * @param {string} itemId - 아이템 ID입니다.
     * @returns {boolean} 벽 통과 operation 보유 여부입니다.
     */
    grantsWallTraversal(itemId) {
        return this.#effects.itemHasOperation(
            itemId,
            EFFECT_TRIGGERS.MOVE_ENTER,
            EFFECT_OPERATIONS.GRANT_WALL_TRAVERSAL
        );
    }

    /**
     * 현재 상태에서 지정 무기로 공격 가능한 대상을 계산합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {{weapon?:'auto'|'melee'|'bow'}} [options={}] - 공격 방식입니다.
     * @returns {Array<object>} 대상과 실제 사용할 무기 목록입니다.
     */
    getValidTargets(state, options = {}) {
        const draft = this.createDraft(state);
        if (!this.canUseAction(draft) || draft.lora.peaceTurns > 0) {
            return [];
        }
        const requestedWeapon = options.weapon ?? 'auto';
        if (requestedWeapon === 'bow' && !this.#hasRangedAttack(draft)) {
            return [];
        }
        const candidates = [];
        if (draft.lora.alive) {
            candidates.push({
                id: LORA_ID,
                type: 'lora',
                x: draft.lora.x,
                y: draft.lora.y,
                hp: draft.lora.hp,
                maxHp: draft.lora.maxHp
            });
        }
        for (const mob of draft.mobs) {
            if (mob.alive) {
                candidates.push({ ...mob, type: 'mob' });
            }
        }
        return candidates.flatMap((target) => {
            const distance = this.getDistance(draft.player, target);
            if (requestedWeapon === 'melee') {
                return distance <= this.#player.attackRange
                    ? [{ ...target, distance, weapon: 'melee' }]
                    : [];
            }
            if (requestedWeapon === 'bow') {
                return [{ ...target, distance, weapon: 'bow' }];
            }
            if (distance <= this.#player.attackRange) {
                return [{ ...target, distance, weapon: 'melee' }];
            }
            return this.#hasRangedAttack(draft)
                ? [{ ...target, distance, weapon: 'bow' }]
                : [];
        });
    }

    /**
     * 플레이어 공격의 검증·무기·피해·불안정도 계산을 만듭니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {string} targetId - 대상 ID입니다.
     * @param {{weapon?:'auto'|'melee'|'bow'}} [options={}] - 공격 방식입니다.
     * @returns {object} 실제 실행과 미리보기가 공유할 공격 계획입니다.
     */
    getPlayerAttackPlan(state, targetId = LORA_ID, options = {}) {
        const draft = this.createDraft(state);
        if (!this.canUseAction(draft)) {
            return this.#failure('attack', 'action-unavailable');
        }
        if (draft.lora.peaceTurns > 0) {
            return this.#failure('attack', 'peace-active');
        }
        const target = this.getValidTargets(draft, { weapon: options.weapon ?? 'auto' })
            .find((candidate) => candidate.id === targetId);
        if (!target) {
            return this.#failure('attack', 'invalid-target');
        }
        const attackExecution = this.#effects.executeOwned(
            this.#getOwnedItemIds(draft),
            EFFECT_TRIGGERS.ATTACK,
            {
                actor: 'player',
                target: target.type,
                weapon: target.weapon,
                baseDamage: target.weapon === 'bow'
                    ? 0
                    : toFiniteNumber(this.#player.attackDamage),
                mushroomActive: draft.player.mushroomActive,
                peaceTurns: draft.lora.peaceTurns
            },
            { mode: options.mode ?? 'preview' }
        );
        const rawDamage = attackExecution.state.rawDamage;
        const attackDamagePenalty = Math.max(
            0,
            -attackExecution.state.flatDamageModifier
        );
        const attackMultiplier = attackExecution.state.damageMultiplier;
        const calculatedDamage = attackExecution.state.calculatedDamage;
        const targetHpBefore = Math.max(0, toFiniteNumber(target.hp));
        const finalDamage = Math.min(targetHpBefore, calculatedDamage);
        const targetHpAfter = Math.max(0, targetHpBefore - calculatedDamage);
        const instabilityCalculation = target.type === 'lora'
            ? this.calculateInstabilityChange(draft, {
                instability: draft.lora.instability,
                maxInstability: draft.lora.maxInstability,
                requestedChange: toFiniteNumber(this.#player.attackInstability)
                    + (draft.consecutiveAttackCount
                        * toFiniteNumber(this.#player.consecutiveAttackInstability))
            }, { mode: options.mode ?? 'preview' })
            : null;
        return {
            ok: true,
            reason: 'action-available',
            action: 'attack',
            targetId: target.id,
            targetType: target.type,
            targetTile: cloneTile(target),
            weapon: target.weapon,
            rawDamage,
            attackDamagePenalty,
            attackMultiplier,
            effectOperations: attackExecution.operations,
            calculatedDamage,
            finalDamage,
            targetHpBefore,
            targetHpAfter,
            defeated: targetHpAfter <= 0,
            instabilityCalculation
        };
    }

    /** @param {object} state @returns {object} 회복 행동 계획입니다. */
    getHealPlan(state) {
        const draft = this.createDraft(state);
        if (!this.canUseAction(draft)) {
            return this.#failure('heal', 'action-unavailable');
        }
        const requestedAmount = toFiniteNumber(this.#player.healAmount);
        const amount = Math.min(
            draft.player.maxHp - draft.player.hp,
            Math.max(0, requestedAmount)
        );
        return {
            ok: true,
            reason: 'action-available',
            action: 'heal',
            requestedAmount,
            amount,
            playerHpBefore: draft.player.hp,
            playerHpAfter: draft.player.hp + amount
        };
    }

    /** @param {object} state @returns {object} 대기 행동 계획입니다. */
    getWaitPlan(state) {
        const draft = this.createDraft(state);
        return this.canUseAction(draft)
            ? { ok: true, reason: 'action-available', action: 'wait' }
            : this.#failure('wait', 'action-unavailable');
    }

    /**
     * 아이템 사용 가능 여부와 순수 효과 계산을 만듭니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {string} itemId - 아이템 ID입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 아이템 사용 계획입니다.
     */
    getItemUsePlan(state, itemId, options = {}) {
        const draft = this.createDraft(state);
        if (!this.canUseAction(draft)) {
            return this.#failure('use-item', 'action-unavailable', { itemId });
        }
        const item = this.#items[itemId];
        if (!item || !this.hasItem(draft, itemId)) {
            return this.#failure('use-item', 'item-not-owned', { itemId });
        }
        if (this.isPassiveItem(itemId) || !this.#effects.isUsableItem(itemId)) {
            return this.#failure('use-item', 'passive-item', { itemId });
        }
        if (item.movementConsumable === true) {
            return this.#failure('use-item', 'movement-item', { itemId });
        }
        if (item.useOnce && draft.usedItems.has(itemId)) {
            return this.#failure('use-item', 'item-already-used', { itemId });
        }

        const execution = this.#effects.executeItem(
            itemId,
            EFFECT_TRIGGERS.USE,
            {
                itemIds: this.#getOwnedItemIds(draft),
                instability: draft.lora.instability,
                maxInstability: draft.lora.maxInstability,
                peaceTurns: draft.lora.peaceTurns,
                extraPlayerTurns: draft.extraPlayerTurns,
                mushroomActive: draft.player.mushroomActive
            },
            { mode: options.mode ?? 'preview' }
        );
        if (execution.operations.length === 0) {
            return this.#failure('use-item', 'unsupported-item-effect', { itemId });
        }
        const instabilityOperation = execution.operations.find(
            ({ instabilityCalculation }) => instabilityCalculation
        );
        const hasPeaceChange = execution.operations.some(({ operation }) => (
            operation === EFFECT_OPERATIONS.SET_PEACE_TURNS_MIN
        ));
        const hasMushroomChange = execution.operations.some(({ operation }) => (
            operation === EFFECT_OPERATIONS.SET_MUSHROOM_ACTIVE
        ));
        const consumesItem = item.consumable === true || item.useOnce === true;
        return {
            ok: true,
            reason: 'action-available',
            action: 'use-item',
            itemId,
            effectType: itemId,
            consumesItem,
            consumeCount: consumesItem ? 1 : 0,
            instabilityCalculation: instabilityOperation?.instabilityCalculation ?? null,
            peaceTurnsAfter: hasPeaceChange ? execution.state.peaceTurns : null,
            extraPlayerTurnsAdded: Math.max(
                0,
                execution.state.extraPlayerTurns - draft.extraPlayerTurns
            ),
            mushroomActiveAfter: hasMushroomChange
                ? execution.state.mushroomActive
                : null,
            effects: this.#createLegacyEffectResults(itemId, execution.operations),
            effectExecution: execution
        };
    }

    /**
     * 이동 단계 전용 아이템의 이벤트 타일 변경 계획을 계산합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {string} itemId - 이동 아이템 ID입니다.
     * @param {object} eventTile - 대상 이벤트 타일입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 타일 변경과 소모 계획입니다.
     */
    getMovementItemUsePlan(state, itemId, eventTile, options = {}) {
        const draft = this.createDraft(state);
        if (draft.turn !== 'player'
            || draft.phase !== 'move'
            || draft.movementUsed
            || draft.result
            || !draft.player.alive) {
            return this.#failure('cleanse-event-tile', 'movement-unavailable', { itemId });
        }
        const item = this.#items[itemId];
        if (!item || !this.hasItem(draft, itemId)) {
            return this.#failure('cleanse-event-tile', 'item-not-owned', { itemId });
        }
        if (item.movementConsumable !== true || !this.#effects.isUsableItem(itemId)) {
            return this.#failure('cleanse-event-tile', 'movement-item', { itemId });
        }
        if (!eventTile || !this.#effects.isNegativeEventTile(eventTile.type)) {
            return this.#failure('cleanse-event-tile', 'invalid-event-tile', { itemId });
        }
        const execution = this.#effects.executeItem(
            itemId,
            EFFECT_TRIGGERS.USE,
            {
                itemIds: this.#getOwnedItemIds(draft),
                eventTileType: eventTile.type
            },
            { mode: options.mode ?? 'preview' }
        );
        const replacement = execution.operations.find(({ operation }) => (
            operation === EFFECT_OPERATIONS.REPLACE_EVENT_TILE_TYPE
        ));
        if (!replacement) {
            return this.#failure('cleanse-event-tile', 'invalid-event-tile', { itemId });
        }
        return {
            ok: true,
            reason: 'action-available',
            action: 'cleanse-event-tile',
            itemId,
            consumesItem: true,
            consumeCount: 1,
            eventTileTypeBefore: eventTile.type,
            eventTileTypeAfter: execution.state.eventTileType,
            effects: this.#createLegacyEffectResults(itemId, execution.operations),
            effectExecution: execution
        };
    }

    /** @param {string} eventType @returns {boolean} 페널티 이벤트 타일 여부입니다. */
    isNegativeEventTile(eventType) {
        return this.#effects.isNegativeEventTile(eventType);
    }

    /**
     * 이벤트 타일의 이동·피해·불안정도 결과를 공통 executor로 계산합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {string} eventType - 이벤트 타일 유형입니다.
     * @param {{remainingMoves?:number,mode?:'preview'|'apply'}} [options={}] - 이동력과 실행 목적입니다.
     * @returns {object} 타일 효과 계획입니다.
     */
    getEventTilePlan(state, eventType, options = {}) {
        const draft = this.createDraft(state);
        const execution = this.#effects.executeEventTile(
            eventType,
            EFFECT_TRIGGERS.MOVE_ENTER,
            {
                itemIds: this.#getOwnedItemIds(draft),
                actor: 'player',
                target: 'player',
                playerHp: draft.player.hp,
                instability: draft.lora.instability,
                maxInstability: draft.lora.maxInstability,
                mushroomActive: draft.player.mushroomActive,
                peaceTurns: draft.lora.peaceTurns,
                remainingMoves: Math.max(0, toFiniteNumber(options.remainingMoves))
            },
            { mode: options.mode ?? 'preview' }
        );
        return {
            eventType,
            remainingMovesAfter: execution.state.remainingMoves,
            damageCalculation: execution.operations.find(
                ({ damageCalculation }) => damageCalculation
            )?.damageCalculation ?? null,
            instabilityCalculations: execution.operations
                .filter(({ instabilityCalculation }) => instabilityCalculation)
                .map(({ source, instabilityCalculation }) => ({
                    ...instabilityCalculation,
                    source
                })),
            effectExecution: execution
        };
    }

    /**
     * 플레이어 턴 종료 패시브를 계산합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 순서가 보존된 불안정도 변경입니다.
     */
    getPlayerTurnEndPlan(state, options = {}) {
        const draft = this.createDraft(state);
        const execution = this.#effects.executeOwned(
            this.#getOwnedItemIds(draft),
            EFFECT_TRIGGERS.TURN_END,
            {
                actor: 'player',
                instability: draft.lora.instability,
                maxInstability: draft.lora.maxInstability,
                mushroomActive: draft.player.mushroomActive,
                peaceTurns: draft.lora.peaceTurns
            },
            { mode: options.mode ?? 'preview' }
        );
        return {
            instabilityCalculations: execution.operations
                .filter(({ instabilityCalculation }) => instabilityCalculation)
                .map(({ source, instabilityCalculation }) => ({
                    ...instabilityCalculation,
                    source
                })),
            effectExecution: execution
        };
    }

    /**
     * 로라 턴 시작 패시브를 순서대로 계산합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 최종 불안정도와 개별 변경입니다.
     */
    getLoraTurnStartPlan(state, options = {}) {
        const draft = this.createDraft(state);
        const execution = this.#effects.executeOwned(
            this.#getOwnedItemIds(draft),
            EFFECT_TRIGGERS.TURN_START,
            {
                actor: 'lora',
                instability: draft.lora.instability,
                maxInstability: draft.lora.maxInstability,
                mushroomActive: draft.player.mushroomActive,
                peaceTurns: draft.lora.peaceTurns,
                peaceActive: draft.lora.peaceTurns > 0
            },
            { mode: options.mode ?? 'preview' }
        );
        return {
            expectedInstability: execution.state.instability,
            instabilityCalculations: execution.operations
                .filter(({ instabilityCalculation }) => instabilityCalculation)
                .map(({ source, instabilityCalculation }) => ({
                    ...instabilityCalculation,
                    source
                })),
            effectExecution: execution
        };
    }

    /**
     * 로라 공격에 적용되는 아이템 피해 변경을 계산합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {number} baseDamage - 상태 단계의 원시 피해입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 원시·보정 피해와 operation입니다.
     */
    getLoraAttackDamagePlan(state, baseDamage, options = {}) {
        const draft = this.createDraft(state);
        const rawDamage = Math.max(0, toFiniteNumber(baseDamage));
        const execution = this.#effects.executeOwned(
            this.#getOwnedItemIds(draft),
            EFFECT_TRIGGERS.ATTACK,
            {
                actor: 'lora',
                target: 'player',
                baseDamage: rawDamage,
                mushroomActive: draft.player.mushroomActive,
                peaceTurns: draft.lora.peaceTurns
            },
            { mode: options.mode ?? 'preview' }
        );
        return {
            rawDamage,
            passiveDamageBonus: Math.max(0, execution.state.calculatedDamage - rawDamage),
            passiveAdjustedDamage: execution.state.calculatedDamage,
            effectExecution: execution
        };
    }

    /**
     * 현재 방어 패시브와 HP 상한을 반영한 플레이어 피해를 계산합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {number} baseDamage - 패시브 적용 전 피해입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 피해 감소와 최종 적용 피해입니다.
     */
    calculatePlayerDamage(state, baseDamage, options = {}) {
        const draft = this.createDraft(state);
        return this.#effects.calculatePlayerDamage(
            this.#getOwnedItemIds(draft),
            {
                baseDamage,
                playerHp: draft.player.hp,
                mushroomActive: draft.player.mushroomActive,
                peaceTurns: draft.lora.peaceTurns
            },
            { mode: options.mode ?? 'preview' }
        );
    }

    /**
     * 오카리나 억제와 상하한을 반영한 불안정도 변경을 계산합니다.
     * @param {object} state - 보유 효과를 확인할 읽기 전용 전투 상태입니다.
     * @param {object} values - 현재값, 최대값과 요청 변화입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 적용 전후와 억제 여부입니다.
     */
    calculateInstabilityChange(state, values = {}, options = {}) {
        const draft = this.createDraft(state);
        return this.#effects.calculateInstabilityChange(
            this.#getOwnedItemIds(draft),
            values,
            { mode: options.mode ?? 'preview' }
        );
    }

    /** @param {object} left @param {object} right @returns {number} 맨해튼 거리입니다. */
    getDistance(left, right) {
        return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
    }

    /** @param {object} state @returns {boolean} 데이터 효과로 원거리 공격이 열렸는지 여부입니다. @private */
    #hasRangedAttack(state) {
        return this.#effects.executeOwned(
            this.#getOwnedItemIds(state),
            EFFECT_TRIGGERS.ATTACK,
            {
                actor: 'player',
                weapon: 'bow',
                baseDamage: 0,
                mushroomActive: state.player.mushroomActive,
                peaceTurns: state.lora.peaceTurns
            },
            { mode: 'preview' }
        ).state.rangedAttackGranted;
    }

    /** @param {object} state @returns {Array<string>} 수량이 남은 아이템 ID입니다. @private */
    #getOwnedItemIds(state) {
        return [...state.inventory.entries()]
            .filter(([, count]) => toFiniteNumber(count) > 0)
            .map(([itemId]) => itemId);
    }

    /**
     * 기존 공개 사용 결과 형식을 operation 결과에서 구성합니다.
     * @param {string} itemId - 효과 원본 아이템입니다.
     * @param {ReadonlyArray<object>} operations - 실행된 operation입니다.
     * @returns {Array<object>} 호환 표시 결과입니다.
     * @private
     */
    #createLegacyEffectResults(itemId, operations) {
        return operations.flatMap((operation) => {
            const builder = LEGACY_EFFECT_RESULT_BUILDERS[operation.operation];
            if (!builder) {
                return [];
            }
            const result = builder(operation);
            if (operation.operation !== EFFECT_OPERATIONS.SET_MUSHROOM_ACTIVE) {
                return [result];
            }
            const moveMultiplier = this.#effects.getItemEffects(
                itemId,
                EFFECT_TRIGGERS.MOVE_ENTER
            ).find(({ operation: operationId }) => (
                operationId === EFFECT_OPERATIONS.MULTIPLY_MOVE_RANGE
            ))?.value ?? 1;
            const attackMultiplier = this.#effects.getItemEffects(
                itemId,
                EFFECT_TRIGGERS.ATTACK
            ).find(({ operation: operationId }) => (
                operationId === EFFECT_OPERATIONS.MULTIPLY_DAMAGE
            ))?.value ?? 1;
            return [{ ...result, moveMultiplier, attackMultiplier }];
        });
    }

    /** @param {string} action @param {string} reason @param {object} [extra={}] @returns {object} 실패 계획입니다. @private */
    #failure(action, reason, extra = {}) {
        return { ok: false, action, reason, ...extra };
    }

    /** @param {number} value @param {number} min @param {number} max @returns {number} 범위 제한값입니다. @private */
    #clamp(value, min, max) {
        return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
    }
}

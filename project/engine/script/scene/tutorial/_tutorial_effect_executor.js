import {
    TUTORIAL_EFFECT_CONDITIONS,
    TUTORIAL_EFFECT_EXECUTION_MODES,
    TUTORIAL_EFFECT_OPERATIONS,
    TUTORIAL_EFFECT_TRIGGERS
} from './_tutorial_effect_contract.js';
import { TutorialEffectRegistry } from './_tutorial_effect_registry.js';

const EXECUTION_MODES = new Set(TUTORIAL_EFFECT_EXECUTION_MODES);
const TRIGGER_IDS = new Set(Object.values(TUTORIAL_EFFECT_TRIGGERS));

/** @param {*} value @param {number} [fallback=0] @returns {number} 유한 숫자입니다. */
function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/** @param {number} value @param {number} min @param {number} max @returns {number} 제한된 값입니다. */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

/** @param {*} value @returns {*} 객체와 하위 값을 재귀적으로 동결합니다. */
function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }
    for (const child of Object.values(value)) {
        deepFreeze(child);
    }
    return Object.freeze(value);
}

/**
 * @class TutorialEffectExecutor
 * @description 검증된 선언형 아이템·이벤트 효과를 같은 순서로 preview/apply 계산합니다.
 */
export class TutorialEffectExecutor {
    #registry;
    #operationHandlers;
    #conditionHandlers;

    /**
     * @param {object} config - 아이템과 이벤트 타일 효과 레지스트리입니다.
     */
    constructor(config = {}) {
        this.#operationHandlers = this.#createOperationHandlers();
        this.#conditionHandlers = this.#createConditionHandlers();
        this.#registry = config.registry instanceof TutorialEffectRegistry
            ? config.registry
            : new TutorialEffectRegistry(config);
        for (const operation of Object.values(TUTORIAL_EFFECT_OPERATIONS)) {
            if (!this.#operationHandlers.has(operation)) {
                throw new TypeError(
                    `TutorialEffectExecutor: operation handler ${operation}이 없습니다.`
                );
            }
        }
        for (const condition of Object.values(TUTORIAL_EFFECT_CONDITIONS)) {
            if (!this.#conditionHandlers.has(condition)) {
                throw new TypeError(
                    `TutorialEffectExecutor: condition handler ${condition}이 없습니다.`
                );
            }
        }
    }

    /** @param {string} itemId @returns {boolean} 사용 없이 자동 적용되는 아이템 여부입니다. */
    isAutomaticItem(itemId) {
        return this.#registry.isAutomaticItem(itemId);
    }

    /** @param {string} itemId @returns {boolean} onUse 효과가 있는지 여부입니다. */
    isUsableItem(itemId) {
        return this.#registry.isUsableItem(itemId);
    }

    /** @param {string} eventType @returns {boolean} 페널티 이벤트 타일 여부입니다. */
    isNegativeEventTile(eventType) {
        return this.#registry.isNegativeEventTile(eventType);
    }

    /**
     * @param {string} itemId - 아이템 ID입니다.
     * @param {string} trigger - 트리거 ID입니다.
     * @returns {ReadonlyArray<object>} 선언 순서를 보존한 효과입니다.
     */
    getItemEffects(itemId, trigger) {
        return this.#registry.getItemEffects(itemId, trigger);
    }

    /**
     * @param {string} itemId - 아이템 ID입니다.
     * @param {string} trigger - 트리거 ID입니다.
     * @param {string} operation - operation ID입니다.
     * @returns {boolean} 해당 효과 보유 여부입니다.
     */
    itemHasOperation(itemId, trigger, operation) {
        return this.#registry.itemHasOperation(itemId, trigger, operation);
    }

    /**
     * 한 아이템의 지정 트리거를 실행합니다.
     * @param {string} itemId - 아이템 ID입니다.
     * @param {string} trigger - 트리거 ID입니다.
     * @param {object} [context={}] - 계산에 필요한 명시적 상태입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 적용 operation과 계산 후 상태입니다.
     */
    executeItem(itemId, trigger, context = {}, options = {}) {
        const owned = this.#registry.getOwnedRecords(context.itemIds, context);
        return this.#executeRecords(
            this.#registry.getItemRecords(itemId),
            trigger,
            { ...context, itemIds: owned.itemIds },
            options
        );
    }

    /**
     * 보유 아이템 전체의 지정 트리거를 안정된 순서로 실행합니다.
     * @param {Iterable<string>} itemIds - 보유 아이템 ID입니다.
     * @param {string} trigger - 트리거 ID입니다.
     * @param {object} [context={}] - 계산에 필요한 명시적 상태입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 적용 operation과 계산 후 상태입니다.
     */
    executeOwned(itemIds, trigger, context = {}, options = {}) {
        const owned = this.#registry.getOwnedRecords(itemIds, context);
        return this.#executeRecords(
            owned.records,
            trigger,
            { ...context, itemIds: owned.itemIds },
            options
        );
    }

    /**
     * 이벤트 타일 유형의 지정 트리거를 실행합니다.
     * @param {string} eventType - 이벤트 타일 유형입니다.
     * @param {string} trigger - 트리거 ID입니다.
     * @param {object} [context={}] - 계산에 필요한 명시적 상태입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 적용 operation과 계산 후 상태입니다.
     */
    executeEventTile(eventType, trigger, context = {}, options = {}) {
        const owned = this.#registry.getOwnedRecords(context.itemIds, context);
        return this.#executeRecords(
            this.#registry.getEventTileRecords(eventType),
            trigger,
            {
                ...context,
                eventTileType: eventType,
                itemIds: owned.itemIds
            },
            options
        );
    }

    /**
     * 보유 효과의 억제 조건과 상하한을 포함해 불안정도 변경을 계산합니다.
     * @param {Iterable<string>} itemIds - 보유 아이템 ID입니다.
     * @param {object} values - 현재값, 최대값, 요청 변화입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 적용 전후와 억제 operation입니다.
     */
    calculateInstabilityChange(itemIds, values = {}, options = {}) {
        const before = clamp(
            toFiniteNumber(values.instability),
            0,
            Math.max(0, toFiniteNumber(values.maxInstability, 100))
        );
        const maxInstability = Math.max(0, toFiniteNumber(values.maxInstability, 100));
        const requestedChange = toFiniteNumber(values.requestedChange);
        const guardExecution = this.executeOwned(
            itemIds,
            TUTORIAL_EFFECT_TRIGGERS.BEFORE_INSTABILITY_CHANGE,
            {
                instability: before,
                maxInstability,
                requestedInstabilityChange: requestedChange
            },
            options
        );
        const suppressed = guardExecution.state.instabilitySuppressed === true;
        const appliedRequest = suppressed ? 0 : requestedChange;
        const after = clamp(before + appliedRequest, 0, maxInstability);
        return deepFreeze({
            before,
            after,
            change: after - before,
            requestedChange,
            suppressed,
            operations: guardExecution.operations
        });
    }

    /**
     * 보유 방어 효과와 HP 상한을 반영한 플레이어 피해를 계산합니다.
     * @param {Iterable<string>} itemIds - 보유 아이템 ID입니다.
     * @param {object} values - 원시 피해, HP와 버섯 상태입니다.
     * @param {{mode?:'preview'|'apply'}} [options={}] - 실행 목적입니다.
     * @returns {object} 감소량, 최종 피해와 상태 종료 여부입니다.
     */
    calculatePlayerDamage(itemIds, values = {}, options = {}) {
        const execution = this.executeOwned(
            itemIds,
            TUTORIAL_EFFECT_TRIGGERS.BEFORE_DAMAGE,
            {
                target: 'player',
                baseDamage: Math.max(0, toFiniteNumber(values.baseDamage)),
                playerHp: Math.max(0, toFiniteNumber(values.playerHp)),
                mushroomActive: values.mushroomActive === true
            },
            options
        );
        const rawDamage = Math.max(0, toFiniteNumber(values.baseDamage));
        return deepFreeze({
            rawDamage,
            reduction: execution.state.damageReduction,
            calculatedDamage: execution.state.calculatedDamage,
            finalDamage: execution.state.finalDamage,
            playerHpBefore: Math.max(0, toFiniteNumber(values.playerHp)),
            playerHpAfter: execution.state.playerHpAfter,
            mushroomEnds: values.mushroomActive === true
                && execution.state.mushroomActive === false,
            mushroomActiveAfter: execution.state.mushroomActive,
            operations: execution.operations
        });
    }

    /** @returns {Map<string,Function>} operation별 실행 함수입니다. @private */
    #createOperationHandlers() {
        const operations = TUTORIAL_EFFECT_OPERATIONS;
        return new Map([
            [operations.SET_RANGED_DAMAGE, (effect, state) => {
                state.rawDamage = effect.value;
                state.damage = effect.value;
                state.rangedAttackGranted = true;
                return { rawDamage: state.rawDamage, rangedAttackGranted: true };
            }],
            [operations.CHANGE_DAMAGE_FLAT, (effect, state) => {
                state.flatDamageModifier += effect.value;
                state.damage += effect.value;
                return { flatDamageChange: effect.value };
            }],
            [operations.MULTIPLY_DAMAGE, (effect, state) => {
                state.damageMultiplier *= effect.value;
                state.damage *= effect.value;
                return { damageMultiplier: effect.value };
            }],
            [operations.REDUCE_DAMAGE_FLAT, (effect, state) => {
                state.damageReduction += effect.value;
                return { damageReduction: effect.value };
            }],
            [operations.CHANGE_INSTABILITY_FLAT, (effect, state, context, mode) => {
                const calculation = this.calculateInstabilityChange(
                    context.itemIds,
                    {
                        instability: state.instability,
                        maxInstability: state.maxInstability,
                        requestedChange: effect.value
                    },
                    { mode }
                );
                state.instability = calculation.after;
                return { instabilityCalculation: calculation };
            }],
            [operations.SCALE_INSTABILITY_CURRENT, (effect, state, context, mode) => {
                const calculation = this.calculateInstabilityChange(
                    context.itemIds,
                    {
                        instability: state.instability,
                        maxInstability: state.maxInstability,
                        requestedChange: -(state.instability * effect.value)
                    },
                    { mode }
                );
                state.instability = calculation.after;
                return { instabilityCalculation: calculation };
            }],
            [operations.SUPPRESS_POSITIVE_INSTABILITY, (_effect, state) => {
                state.instabilitySuppressed = true;
                return { instabilitySuppressed: true };
            }],
            [operations.SET_PEACE_TURNS_MIN, (effect, state) => {
                state.peaceTurns = Math.max(state.peaceTurns, effect.value);
                return { peaceTurnsAfter: state.peaceTurns };
            }],
            [operations.ADD_EXTRA_PLAYER_TURNS, (effect, state) => {
                state.extraPlayerTurns += effect.value;
                return { extraPlayerTurnsAdded: effect.value };
            }],
            [operations.SET_MUSHROOM_ACTIVE, (effect, state) => {
                state.mushroomActive = effect.value;
                return { mushroomActiveAfter: state.mushroomActive };
            }],
            [operations.MULTIPLY_MOVE_RANGE, (effect, state) => {
                state.moveRange *= effect.value;
                return { moveRangeMultiplier: effect.value };
            }],
            [operations.GRANT_WALL_TRAVERSAL, (effect, state) => {
                state.wallTraversal = effect.value;
                return { wallTraversal: state.wallTraversal };
            }],
            [operations.ADD_ACTIONS_PER_TURN, (effect, state) => {
                state.actionsPerTurn += effect.value;
                return { actionsPerTurnAdded: effect.value };
            }],
            [operations.END_MUSHROOM_ON_DAMAGE, (_effect, state) => {
                state.mushroomActive = false;
                return { mushroomActiveAfter: false };
            }],
            [operations.REPLACE_EVENT_TILE_TYPE, (effect, state) => {
                const beforeType = state.eventTileType;
                state.eventTileType = effect.value;
                return { beforeType, afterType: state.eventTileType };
            }],
            [operations.REDUCE_REMAINING_MOVES, (effect, state) => {
                state.remainingMoves = Math.max(0, state.remainingMoves - effect.value);
                return { remainingMovesAfter: state.remainingMoves };
            }],
            [operations.DEAL_PLAYER_DAMAGE, (effect, state, context, mode) => {
                const calculation = this.calculatePlayerDamage(
                    context.itemIds,
                    {
                        baseDamage: effect.value,
                        playerHp: state.playerHp,
                        mushroomActive: state.mushroomActive
                    },
                    { mode }
                );
                state.playerHp = calculation.playerHpAfter;
                state.playerHpAfter = calculation.playerHpAfter;
                state.mushroomActive = calculation.mushroomActiveAfter;
                return { damageCalculation: calculation };
            }]
        ]);
    }

    /** @returns {Map<string,Function>} condition별 판정 함수입니다. @private */
    #createConditionHandlers() {
        const conditions = TUTORIAL_EFFECT_CONDITIONS;
        return new Map([
            [conditions.ACTOR_PLAYER, (context) => context.actor === 'player'],
            [conditions.ACTOR_LORA, (context) => context.actor === 'lora'],
            [conditions.TARGET_PLAYER, (context) => context.target === 'player'],
            [conditions.WEAPON_BOW, (context) => context.weapon === 'bow'],
            [conditions.PEACE_ACTIVE, (context, state) => (
                context.peaceActive === true || state.peaceTurns > 0
            )],
            [conditions.POSITIVE_BASE_DAMAGE, (_context, state) => state.rawDamage > 0],
            [conditions.POSITIVE_FINAL_DAMAGE, (_context, state) => state.finalDamage > 0],
            [conditions.POSITIVE_INSTABILITY_CHANGE, (context) => (
                toFiniteNumber(context.requestedInstabilityChange) > 0
            )],
            [conditions.NEGATIVE_EVENT_TILE, (context, state) => (
                this.#registry.isNegativeEventTile(
                    context.eventTileType ?? state.eventTileType
                )
            )]
        ]);
    }

    /** @param {Array<object>} records @param {string} trigger @param {object} context @param {object} options @returns {object} @private */
    #executeRecords(records, trigger, context, options) {
        if (!TRIGGER_IDS.has(trigger)) {
            throw new TypeError(`TutorialEffectExecutor: 알 수 없는 trigger ${trigger}입니다.`);
        }
        const mode = options.mode ?? 'preview';
        if (!EXECUTION_MODES.has(mode)) {
            throw new TypeError(`TutorialEffectExecutor: 실행 mode ${mode}가 올바르지 않습니다.`);
        }
        if (!context || typeof context !== 'object' || Array.isArray(context)) {
            throw new TypeError('TutorialEffectExecutor: 명시적 context 객체가 필요합니다.');
        }
        const state = this.#createExecutionState(context);
        const selected = records
            .filter(({ effect }) => effect.trigger === trigger)
            .sort((left, right) => (
                left.effect.order - right.effect.order
                || left.sourceOrder - right.sourceOrder
                || left.declarationOrder - right.declarationOrder
                || left.effect.id.localeCompare(right.effect.id)
            ));
        const operations = [];
        for (const record of selected) {
            const { effect } = record;
            const matches = effect.conditions.every((conditionId) => (
                this.#conditionHandlers.get(conditionId)(context, state)
            ));
            if (!matches) {
                continue;
            }
            const outcome = this.#operationHandlers.get(effect.operation)(
                effect,
                state,
                context,
                mode
            ) || {};
            this.#refreshDamageState(state);
            operations.push({
                effectId: effect.id,
                operation: effect.operation,
                sourceKind: record.sourceKind,
                sourceId: record.sourceId,
                source: effect.source ?? record.sourceId,
                order: effect.order,
                ...outcome
            });
        }
        return deepFreeze({
            mode,
            trigger,
            state: { ...state },
            operations
        });
    }

    /** @param {object} context @returns {object} 실행 중 변경할 계산 상태입니다. @private */
    #createExecutionState(context) {
        const playerHp = Number.isFinite(Number(context.playerHp))
            ? Math.max(0, Number(context.playerHp))
            : null;
        const maxInstability = Math.max(0, toFiniteNumber(context.maxInstability, 100));
        const state = {
            rawDamage: Math.max(0, toFiniteNumber(context.baseDamage)),
            damage: Math.max(0, toFiniteNumber(context.baseDamage)),
            flatDamageModifier: 0,
            damageMultiplier: 1,
            damageReduction: 0,
            calculatedDamage: 0,
            finalDamage: 0,
            playerHp,
            playerHpAfter: playerHp,
            instability: clamp(toFiniteNumber(context.instability), 0, maxInstability),
            maxInstability,
            instabilitySuppressed: false,
            peaceTurns: Math.max(0, Math.floor(toFiniteNumber(context.peaceTurns))),
            extraPlayerTurns: Math.max(0, Math.floor(toFiniteNumber(context.extraPlayerTurns))),
            mushroomActive: context.mushroomActive === true,
            moveRange: Math.max(0, toFiniteNumber(context.baseMoveRange)),
            remainingMoves: Math.max(0, toFiniteNumber(context.remainingMoves)),
            actionsPerTurn: Math.max(1, Math.floor(toFiniteNumber(
                context.baseActionsPerTurn,
                1
            ))),
            wallTraversal: context.wallTraversal === true,
            rangedAttackGranted: false,
            eventTileType: typeof context.eventTileType === 'string'
                ? context.eventTileType
                : null
        };
        this.#refreshDamageState(state);
        return state;
    }

    /** @param {object} state @private */
    #refreshDamageState(state) {
        state.calculatedDamage = Math.max(
            0,
            Math.round(state.damage - state.damageReduction)
        );
        state.finalDamage = state.playerHp === null
            ? state.calculatedDamage
            : Math.min(state.playerHp, state.calculatedDamage);
        state.playerHpAfter = state.playerHp === null
            ? null
            : Math.max(0, state.playerHp - state.calculatedDamage);
    }

}

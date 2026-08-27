import {
    TUTORIAL_EFFECT_CONDITIONS,
    TUTORIAL_EFFECT_OPERATIONS,
    TUTORIAL_EFFECT_TRIGGERS
} from './_tutorial_effect_contract.js';

const TRIGGER_IDS = new Set(Object.values(TUTORIAL_EFFECT_TRIGGERS));
const OPERATION_IDS = new Set(Object.values(TUTORIAL_EFFECT_OPERATIONS));
const CONDITION_IDS = new Set(Object.values(TUTORIAL_EFFECT_CONDITIONS));

const NON_NEGATIVE_VALUE_OPERATIONS = new Set([
    TUTORIAL_EFFECT_OPERATIONS.SET_RANGED_DAMAGE,
    TUTORIAL_EFFECT_OPERATIONS.REDUCE_DAMAGE_FLAT,
    TUTORIAL_EFFECT_OPERATIONS.DEAL_PLAYER_DAMAGE
]);
const NON_NEGATIVE_INTEGER_VALUE_OPERATIONS = new Set([
    TUTORIAL_EFFECT_OPERATIONS.SET_PEACE_TURNS_MIN,
    TUTORIAL_EFFECT_OPERATIONS.ADD_EXTRA_PLAYER_TURNS,
    TUTORIAL_EFFECT_OPERATIONS.ADD_ACTIONS_PER_TURN,
    TUTORIAL_EFFECT_OPERATIONS.REDUCE_REMAINING_MOVES
]);
const FINITE_VALUE_OPERATIONS = new Set([
    TUTORIAL_EFFECT_OPERATIONS.CHANGE_DAMAGE_FLAT,
    TUTORIAL_EFFECT_OPERATIONS.CHANGE_INSTABILITY_FLAT
]);
const MULTIPLIER_OPERATIONS = new Set([
    TUTORIAL_EFFECT_OPERATIONS.MULTIPLY_DAMAGE,
    TUTORIAL_EFFECT_OPERATIONS.MULTIPLY_MOVE_RANGE
]);
const BOOLEAN_VALUE_OPERATIONS = new Set([
    TUTORIAL_EFFECT_OPERATIONS.SET_MUSHROOM_ACTIVE,
    TUTORIAL_EFFECT_OPERATIONS.GRANT_WALL_TRAVERSAL
]);

/** @param {*} value @param {number} [fallback=0] @returns {number} 유한 숫자입니다. */
function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/**
 * @class TutorialEffectRegistry
 * @description 선언형 아이템·이벤트 효과를 생성 시 검증하고 실행 가능한 원본 목록을 제공합니다.
 */
export class TutorialEffectRegistry {
    #items;
    #itemOrder;
    #eventTileEffects;

    /** @param {object} config - 아이템과 이벤트 타일 효과 데이터입니다. */
    constructor(config = {}) {
        const seenEffectIds = new Set();
        const normalizedItems = this.#normalizeItems(config.items, seenEffectIds);
        this.#items = normalizedItems.items;
        this.#itemOrder = normalizedItems.order;
        this.#eventTileEffects = this.#normalizeEventTileEffects(
            config.eventTileEffects,
            seenEffectIds
        );
        this.#validateEventTileReferences();
    }

    /** @param {string} itemId @returns {boolean} 사용 없이 자동 적용되는 아이템 여부입니다. */
    isAutomaticItem(itemId) {
        const item = this.#items[itemId];
        return Boolean(item?.passive)
            && !item.effects.some(({ trigger }) => trigger === TUTORIAL_EFFECT_TRIGGERS.USE);
    }

    /** @param {string} itemId @returns {boolean} onUse 효과가 있는지 여부입니다. */
    isUsableItem(itemId) {
        return this.getItemEffects(itemId, TUTORIAL_EFFECT_TRIGGERS.USE).length > 0;
    }

    /** @param {string} eventType @returns {boolean} 페널티 이벤트 타일 여부입니다. */
    isNegativeEventTile(eventType) {
        return this.#eventTileEffects[eventType]?.polarity === 'negative';
    }

    /**
     * @param {string} itemId - 아이템 ID입니다.
     * @param {string} trigger - 트리거 ID입니다.
     * @returns {ReadonlyArray<object>} 선언 순서를 보존한 효과입니다.
     */
    getItemEffects(itemId, trigger) {
        this.#requireTrigger(trigger);
        const item = this.#items[itemId];
        return Object.freeze(item
            ? item.effects.filter((effect) => effect.trigger === trigger)
            : []);
    }

    /**
     * @param {string} itemId - 아이템 ID입니다.
     * @param {string} trigger - 트리거 ID입니다.
     * @param {string} operation - operation ID입니다.
     * @returns {boolean} 해당 효과 보유 여부입니다.
     */
    itemHasOperation(itemId, trigger, operation) {
        this.#requireOperation(operation);
        return this.getItemEffects(itemId, trigger).some((effect) => (
            effect.operation === operation
        ));
    }

    /**
     * 한 아이템의 효과에 원본 정보를 붙입니다.
     * @param {string} itemId - 아이템 ID입니다.
     * @returns {ReadonlyArray<object>} executor용 효과 레코드입니다.
     */
    getItemRecords(itemId) {
        const item = this.#items[itemId];
        if (!item) {
            throw new RangeError(`TutorialEffectRegistry: 알 수 없는 아이템 ${itemId}입니다.`);
        }
        return Object.freeze(item.effects.map((effect, index) => Object.freeze({
            effect,
            sourceKind: 'item',
            sourceId: itemId,
            sourceOrder: this.#itemOrder.get(itemId) ?? 0,
            declarationOrder: index
        })));
    }

    /**
     * 보유·지속 효과 원본과 executor용 레코드를 데이터 순서로 반환합니다.
     * @param {Iterable<string>} itemIds - 현재 보유 아이템 ID입니다.
     * @param {object} [context={}] - 지속 상태 context입니다.
     * @returns {{itemIds:ReadonlyArray<string>,records:ReadonlyArray<object>}} 실행 원본입니다.
     */
    getOwnedRecords(itemIds, context = {}) {
        const resolvedItemIds = this.#resolveEffectItemIds(itemIds, context);
        return Object.freeze({
            itemIds: Object.freeze(resolvedItemIds),
            records: Object.freeze(resolvedItemIds.flatMap((itemId) => (
                this.getItemRecords(itemId)
            )))
        });
    }

    /**
     * 이벤트 타일 효과에 원본 정보를 붙입니다.
     * @param {string} eventType - 이벤트 타일 유형입니다.
     * @returns {ReadonlyArray<object>} executor용 효과 레코드입니다.
     */
    getEventTileRecords(eventType) {
        const entry = this.#eventTileEffects[eventType];
        if (!entry) {
            throw new RangeError(
                `TutorialEffectRegistry: 알 수 없는 이벤트 타일 ${eventType}입니다.`
            );
        }
        return Object.freeze(entry.effects.map((effect, index) => Object.freeze({
            effect,
            sourceKind: 'event-tile',
            sourceId: eventType,
            sourceOrder: 0,
            declarationOrder: index
        })));
    }

    /** @param {object} items @param {Set<string>} seenEffectIds @returns {{items:object,order:Map<string,number>}} @private */
    #normalizeItems(items, seenEffectIds) {
        if (!items || typeof items !== 'object' || Array.isArray(items)) {
            throw new TypeError('TutorialEffectRegistry: items 레지스트리가 필요합니다.');
        }
        const order = new Map();
        const normalized = {};
        Object.entries(items).forEach(([itemId, item], itemIndex) => {
            if (!item || item.id !== itemId || !Array.isArray(item.effects)) {
                throw new TypeError(
                    `TutorialEffectRegistry: ITEMS.${itemId}.effects가 올바르지 않습니다.`
                );
            }
            order.set(itemId, itemIndex);
            normalized[itemId] = Object.freeze({
                ...item,
                effects: this.#normalizeEffects(
                    item.effects,
                    `ITEMS.${itemId}.effects`,
                    seenEffectIds
                )
            });
        });
        return { items: Object.freeze(normalized), order };
    }

    /** @param {object} registry @param {Set<string>} seenEffectIds @returns {object} @private */
    #normalizeEventTileEffects(registry, seenEffectIds) {
        if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
            throw new TypeError(
                'TutorialEffectRegistry: EVENT_TILE_EFFECTS 레지스트리가 필요합니다.'
            );
        }
        const normalized = {};
        for (const [eventType, entry] of Object.entries(registry)) {
            if (!entry
                || entry.id !== eventType
                || !['negative', 'positive'].includes(entry.polarity)
                || !Array.isArray(entry.effects)) {
                throw new TypeError(
                    `TutorialEffectRegistry: EVENT_TILE_EFFECTS.${eventType}가 올바르지 않습니다.`
                );
            }
            normalized[eventType] = Object.freeze({
                ...entry,
                effects: this.#normalizeEffects(
                    entry.effects,
                    `EVENT_TILE_EFFECTS.${eventType}.effects`,
                    seenEffectIds
                )
            });
        }
        return Object.freeze(normalized);
    }

    /** @param {Array<object>} effects @param {string} label @param {Set<string>} seenEffectIds @returns {ReadonlyArray<object>} @private */
    #normalizeEffects(effects, label, seenEffectIds) {
        return Object.freeze(effects.map((effect, index) => {
            const effectLabel = `${label}[${index}]`;
            if (!effect
                || typeof effect.id !== 'string'
                || effect.id.length === 0
                || seenEffectIds.has(effect.id)) {
                throw new TypeError(`${effectLabel}.id가 없거나 중복되었습니다.`);
            }
            this.#requireTrigger(effect.trigger, effectLabel);
            this.#requireOperation(effect.operation, effectLabel);
            if (!Number.isInteger(effect.order) || effect.order < 0) {
                throw new TypeError(`${effectLabel}.order는 0 이상의 정수여야 합니다.`);
            }
            const conditions = effect.conditions ?? [];
            if (!Array.isArray(conditions)
                || new Set(conditions).size !== conditions.length
                || conditions.some((conditionId) => !CONDITION_IDS.has(conditionId))) {
                throw new TypeError(`${effectLabel}.conditions가 올바르지 않습니다.`);
            }
            if (effect.source !== undefined
                && (typeof effect.source !== 'string' || effect.source.length === 0)) {
                throw new TypeError(`${effectLabel}.source가 올바르지 않습니다.`);
            }
            this.#validateOperationValue(effect, effectLabel);
            seenEffectIds.add(effect.id);
            return Object.freeze({
                ...effect,
                conditions: Object.freeze([...conditions])
            });
        }));
    }

    /** @param {object} effect @param {string} label @private */
    #validateOperationValue(effect, label) {
        const operation = effect.operation;
        if (NON_NEGATIVE_VALUE_OPERATIONS.has(operation)
            && (!Number.isFinite(effect.value) || effect.value < 0)) {
            throw new TypeError(`${label}.value는 0 이상의 유한수여야 합니다.`);
        }
        if (NON_NEGATIVE_INTEGER_VALUE_OPERATIONS.has(operation)
            && (!Number.isInteger(effect.value) || effect.value < 0)) {
            throw new TypeError(`${label}.value는 0 이상의 정수여야 합니다.`);
        }
        if (FINITE_VALUE_OPERATIONS.has(operation) && !Number.isFinite(effect.value)) {
            throw new TypeError(`${label}.value는 유한수여야 합니다.`);
        }
        if (MULTIPLIER_OPERATIONS.has(operation)
            && (!Number.isFinite(effect.value) || effect.value <= 0)) {
            throw new TypeError(`${label}.value는 양의 유한수여야 합니다.`);
        }
        if (BOOLEAN_VALUE_OPERATIONS.has(operation) && typeof effect.value !== 'boolean') {
            throw new TypeError(`${label}.value는 boolean이어야 합니다.`);
        }
        if (operation === TUTORIAL_EFFECT_OPERATIONS.SCALE_INSTABILITY_CURRENT
            && (!Number.isFinite(effect.value) || effect.value <= 0 || effect.value > 1)) {
            throw new TypeError(`${label}.value는 0 초과 1 이하 비율이어야 합니다.`);
        }
        if (operation === TUTORIAL_EFFECT_OPERATIONS.REPLACE_EVENT_TILE_TYPE
            && (typeof effect.value !== 'string' || effect.value.length === 0)) {
            throw new TypeError(`${label}.value는 이벤트 타일 ID여야 합니다.`);
        }
    }

    /** 이벤트 타일 치환 operation이 실제 레지스트리 키만 참조하는지 검증합니다. @private */
    #validateEventTileReferences() {
        const sources = [
            ...Object.entries(this.#items).map(([itemId, item]) => ({
                label: `ITEMS.${itemId}.effects`,
                effects: item.effects
            })),
            ...Object.entries(this.#eventTileEffects).map(([eventType, entry]) => ({
                label: `EVENT_TILE_EFFECTS.${eventType}.effects`,
                effects: entry.effects
            }))
        ];
        for (const source of sources) {
            for (const effect of source.effects) {
                if (effect.operation === TUTORIAL_EFFECT_OPERATIONS.REPLACE_EVENT_TILE_TYPE
                    && !Object.hasOwn(this.#eventTileEffects, effect.value)) {
                    throw new TypeError(
                        `${source.label}: 알 수 없는 이벤트 타일 ${effect.value}입니다.`
                    );
                }
            }
        }
    }

    /** @param {Iterable<string>} itemIds @returns {Array<string>} 데이터 순서의 보유 ID입니다. @private */
    #normalizeItemIds(itemIds) {
        const source = itemIds
            && typeof itemIds !== 'string'
            && typeof itemIds[Symbol.iterator] === 'function'
            ? [...itemIds]
            : [];
        return [...new Set(source)]
            .filter((itemId) => typeof itemId === 'string' && this.#items[itemId])
            .sort((left, right) => (
                (this.#itemOrder.get(left) ?? 0) - (this.#itemOrder.get(right) ?? 0)
            ));
    }

    /**
     * 소비 뒤 상태로 유지되는 효과 원본을 operation 계약으로 다시 포함합니다.
     * @param {Iterable<string>} itemIds - 현재 보유 아이템입니다.
     * @param {object} context - 평화 턴과 버섯 활성 상태입니다.
     * @returns {Array<string>} 실행에 참여할 데이터 순서의 아이템 ID입니다.
     * @private
     */
    #resolveEffectItemIds(itemIds, context) {
        const resolved = new Set(this.#normalizeItemIds(itemIds));
        for (const [itemId, item] of Object.entries(this.#items)) {
            if (context.mushroomActive === true && item.effects.some((effect) => (
                effect.operation === TUTORIAL_EFFECT_OPERATIONS.SET_MUSHROOM_ACTIVE
                && effect.value === true
            ))) {
                resolved.add(itemId);
            }
            if (toFiniteNumber(context.peaceTurns) > 0 && item.effects.some((effect) => (
                effect.operation === TUTORIAL_EFFECT_OPERATIONS.SET_PEACE_TURNS_MIN
            ))) {
                resolved.add(itemId);
            }
        }
        return this.#normalizeItemIds(resolved);
    }

    /** @param {string} trigger @param {string} [label='effect'] @private */
    #requireTrigger(trigger, label = 'effect') {
        if (!TRIGGER_IDS.has(trigger)) {
            throw new TypeError(`${label}: 알 수 없는 trigger ${trigger}입니다.`);
        }
    }

    /** @param {string} operation @param {string} [label='effect'] @private */
    #requireOperation(operation, label = 'effect') {
        if (!OPERATION_IDS.has(operation)) {
            throw new TypeError(`${label}: 알 수 없는 operation ${operation}입니다.`);
        }
    }
}

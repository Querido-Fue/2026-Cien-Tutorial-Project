const LORA_ID = 'lora';

const PASSIVE_ITEM_TYPES = new Set([
    'bow',
    'mascot-costume',
    'diamond-pickaxe',
    'ocarina',
    'haste'
]);

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

/**
 * @class TutorialCombatRules
 * @description 플레이어 전투 행동에 공통으로 쓰는 검증과 원자적 수치 계산을 제공합니다.
 */
export class TutorialCombatRules {
    #items;
    #player;

    /** @param {object} config - 모델이 검증한 아이템·플레이어 설정입니다. */
    constructor(config = {}) {
        this.#items = Object.freeze({ ...(config.items || {}) });
        this.#player = Object.freeze({ ...(config.player || {}) });
    }

    /** @param {string} itemId @returns {boolean} 자동 적용 아이템 여부입니다. */
    isPassiveItem(itemId) {
        return PASSIVE_ITEM_TYPES.has(this.#items[itemId]?.effect?.type);
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
        return 1 + (this.hasItem(state, 'haste')
            ? toFiniteNumber(this.#items.haste?.effect?.actionCountBonus)
            : 0);
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
        if (requestedWeapon === 'bow' && !this.hasItem(draft, 'bow')) {
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
            return this.hasItem(draft, 'bow')
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
        const rawDamage = target.weapon === 'bow'
            ? toFiniteNumber(this.#items.bow?.effect?.rangedDamage)
            : toFiniteNumber(this.#player.attackDamage);
        const attackDamagePenalty = this.hasItem(draft, 'old-teddy')
            ? toFiniteNumber(this.#items['old-teddy']?.effect?.attackDamagePenalty)
            : 0;
        const attackMultiplier = draft.player.mushroomActive
            ? toFiniteNumber(this.#items.mushroom?.effect?.attackMultiplier, 1)
            : 1;
        const calculatedDamage = Math.max(
            0,
            Math.round((rawDamage - attackDamagePenalty) * attackMultiplier)
        );
        const targetHpBefore = Math.max(0, toFiniteNumber(target.hp));
        const finalDamage = Math.min(targetHpBefore, calculatedDamage);
        const targetHpAfter = Math.max(0, targetHpBefore - calculatedDamage);
        const instabilityCalculation = target.type === 'lora'
            ? this.calculateInstabilityChange({
                instability: draft.lora.instability,
                maxInstability: draft.lora.maxInstability,
                requestedChange: toFiniteNumber(this.#player.attackInstability)
                    + (draft.consecutiveAttackCount
                        * toFiniteNumber(this.#player.consecutiveAttackInstability)),
                hasOcarina: this.hasItem(draft, 'ocarina')
            })
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
     * @returns {object} 아이템 사용 계획입니다.
     */
    getItemUsePlan(state, itemId) {
        const draft = this.createDraft(state);
        if (!this.canUseAction(draft)) {
            return this.#failure('use-item', 'action-unavailable', { itemId });
        }
        const item = this.#items[itemId];
        if (!item || !this.hasItem(draft, itemId)) {
            return this.#failure('use-item', 'item-not-owned', { itemId });
        }
        if (this.isPassiveItem(itemId)) {
            return this.#failure('use-item', 'passive-item', { itemId });
        }
        if (item.effect.type === 'tile-cleanser') {
            return this.#failure('use-item', 'movement-item', { itemId });
        }
        if (item.useOnce && draft.usedItems.has(itemId)) {
            return this.#failure('use-item', 'item-already-used', { itemId });
        }

        const plan = {
            ok: true,
            reason: 'action-available',
            action: 'use-item',
            itemId,
            effectType: item.effect.type,
            consumesItem: item.consumable === true || item.useOnce === true,
            consumeCount: item.consumable === true || item.useOnce === true ? 1 : 0,
            instabilityCalculation: null,
            peaceTurnsAfter: null,
            extraPlayerTurnsAdded: 0,
            mushroomActiveAfter: null,
            effects: []
        };
        const effect = item.effect;
        if (effect.type === 'old-teddy' || effect.type === 'eyeliner') {
            plan.instabilityCalculation = this.calculateInstabilityChange({
                instability: draft.lora.instability,
                maxInstability: draft.lora.maxInstability,
                requestedChange: -toFiniteNumber(effect.instabilityReduction),
                hasOcarina: this.hasItem(draft, 'ocarina')
            });
            plan.effects.push({
                type: 'stabilize',
                instabilityChange: plan.instabilityCalculation.change
            });
        } else if (effect.type === 'music-box') {
            plan.peaceTurnsAfter = Math.max(
                draft.lora.peaceTurns,
                toFiniteNumber(effect.durationLoraTurns)
            );
            plan.effects.push({
                type: 'peace',
                durationLoraTurns: plan.peaceTurnsAfter
            });
        } else if (effect.type === 'mirror') {
            plan.extraPlayerTurnsAdded = Math.max(0, toFiniteNumber(effect.extraPlayerTurns));
            plan.effects.push({
                type: 'extra-player-turn',
                count: plan.extraPlayerTurnsAdded
            });
        } else if (effect.type === 'mushroom') {
            plan.mushroomActiveAfter = true;
            plan.effects.push({
                type: 'mushroom',
                moveMultiplier: toFiniteNumber(effect.moveMultiplier, 1),
                attackMultiplier: toFiniteNumber(effect.attackMultiplier, 1)
            });
        } else if (effect.type === 'memory-photo') {
            plan.instabilityCalculation = this.calculateInstabilityChange({
                instability: draft.lora.instability,
                maxInstability: draft.lora.maxInstability,
                requestedChange: -(draft.lora.instability
                    * toFiniteNumber(effect.instabilityRatio)),
                hasOcarina: this.hasItem(draft, 'ocarina')
            });
            plan.effects.push({
                type: 'stabilize',
                instabilityChange: plan.instabilityCalculation.change
            });
        } else {
            return this.#failure('use-item', 'unsupported-item-effect', { itemId });
        }
        return plan;
    }

    /**
     * 현재 방어 패시브와 HP 상한을 반영한 플레이어 피해를 계산합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {number} baseDamage - 패시브 적용 전 피해입니다.
     * @returns {object} 피해 감소와 최종 적용 피해입니다.
     */
    calculatePlayerDamage(state, baseDamage) {
        const draft = this.createDraft(state);
        let reduction = 0;
        if (this.hasItem(draft, 'mascot-costume')) {
            reduction += toFiniteNumber(this.#items['mascot-costume']?.effect?.damageReduction);
        }
        if (this.hasItem(draft, 'old-teddy')) {
            reduction += toFiniteNumber(this.#items['old-teddy']?.effect?.damageReduction);
        }
        const rawDamage = Math.max(0, toFiniteNumber(baseDamage));
        const calculatedDamage = Math.max(0, Math.round(rawDamage - reduction));
        const finalDamage = Math.min(draft.player.hp, calculatedDamage);
        return {
            rawDamage,
            reduction,
            calculatedDamage,
            finalDamage,
            playerHpBefore: draft.player.hp,
            playerHpAfter: Math.max(0, draft.player.hp - calculatedDamage),
            mushroomEnds: finalDamage > 0 && draft.player.mushroomActive
        };
    }

    /**
     * 오카리나 억제와 상하한을 반영한 불안정도 변경을 계산합니다.
     * @param {object} values - 현재값, 최대값, 요청 변화와 오카리나 여부입니다.
     * @returns {object} 적용 전후와 억제 여부입니다.
     */
    calculateInstabilityChange({
        instability,
        maxInstability,
        requestedChange,
        hasOcarina = false
    } = {}) {
        const before = this.#clamp(
            toFiniteNumber(instability),
            0,
            Math.max(0, toFiniteNumber(maxInstability, 100))
        );
        const requested = toFiniteNumber(requestedChange);
        const suppressed = requested > 0 && hasOcarina === true;
        const appliedRequest = suppressed ? 0 : requested;
        const after = this.#clamp(
            before + appliedRequest,
            0,
            Math.max(0, toFiniteNumber(maxInstability, 100))
        );
        return {
            before,
            after,
            change: after - before,
            requestedChange: requested,
            suppressed
        };
    }

    /** @param {object} left @param {object} right @returns {number} 맨해튼 거리입니다. */
    getDistance(left, right) {
        return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
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

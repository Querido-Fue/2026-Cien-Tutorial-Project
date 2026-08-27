const LORA_ID = 'lora';

/** @param {*} value @param {number} [fallback=0] @returns {number} 유한 숫자입니다. */
function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/**
 * @class TutorialPlayerActionPreviewer
 * @description 공통 전투 계획을 독립 상태에 적용해 플레이어 행동 후 상태를 예측합니다.
 */
export class TutorialPlayerActionPreviewer {
    #rules;
    #items;

    /** @param {object} config - 공통 규칙과 아이템 설정입니다. */
    constructor(config = {}) {
        this.#rules = config.rules;
        this.#items = Object.freeze({ ...(config.items || {}) });
    }

    /**
     * 선택한 플레이어 행동의 최종 예상 상태를 비변이로 계산합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {'attack'|'heal'|'use-item'|'wait'} action - 행동 ID입니다.
     * @param {object} [options={}] - targetId, weapon 또는 itemId입니다.
     * @returns {object} 검증 reason, 실행 계획과 예상 변경입니다.
     */
    preview(state, action, options = {}) {
        const draft = this.#rules.createDraft(state);
        const plan = this.#getPlan(draft, action, options);
        const before = this.#createExpectedState(draft, plan.targetId);
        if (!plan.ok) {
            const expected = this.#createExpectedState(draft, plan.targetId);
            return {
                ...plan,
                before,
                expected,
                consumesItem: false,
                consumedItemCount: 0,
                persistentEffects: [],
                changes: this.#createChanges(before, expected, plan)
            };
        }

        const instabilityChanges = [];
        if (action === 'attack') {
            this.#applyAttack(draft, plan, instabilityChanges);
        } else if (action === 'heal') {
            draft.player.hp = plan.playerHpAfter;
            draft.player.alive = draft.player.hp > 0;
            draft.consecutiveAttackCount = 0;
        } else if (action === 'use-item') {
            this.#applyItem(draft, plan, instabilityChanges);
        } else if (action === 'wait') {
            draft.consecutiveAttackCount = 0;
        }

        const bonusPlayerTurnStarted = this.#consumeAction(
            draft,
            action === 'wait',
            instabilityChanges
        );
        if (action === 'attack' && plan.targetType === 'lora' && !draft.lora.alive) {
            draft.result = {
                outcome: 'success',
                reason: 'lora-neutralized'
            };
            draft.turn = 'result';
            draft.phase = 'result';
        }
        const expected = this.#createExpectedState(draft, plan.targetId);
        return {
            ...plan,
            before,
            expected,
            consumesItem: plan.consumesItem === true,
            consumedItemCount: plan.consumeCount || 0,
            persistentEffects: (plan.effects || []).map((effect) => ({ ...effect })),
            instabilityChanges,
            changes: this.#createChanges(before, expected, plan, {
                bonusPlayerTurnStarted
            })
        };
    }

    /**
     * 현재 가능한 공격·회복·아이템·대기 미리보기를 한 번에 계산합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @returns {object} 행동 종류별 미리보기입니다.
     */
    getAll(state) {
        const draft = this.#rules.createDraft(state);
        const attack = Object.fromEntries(['melee', 'bow'].map((weapon) => ([
            weapon,
            this.#rules.getValidTargets(draft, { weapon }).map((target) => (
                this.preview(draft, 'attack', {
                    targetId: target.id,
                    weapon
                })
            ))
        ])));
        const items = [...draft.inventory.entries()]
            .filter(([, count]) => count > 0)
            .map(([itemId]) => this.preview(draft, 'use-item', { itemId }))
            .filter((preview) => preview.ok);
        return {
            attack,
            heal: this.preview(draft, 'heal'),
            items,
            wait: this.preview(draft, 'wait')
        };
    }

    /** @param {object} state @param {string} action @param {object} options @returns {object} 행동 계획입니다. @private */
    #getPlan(state, action, options) {
        if (action === 'attack') {
            return this.#rules.getPlayerAttackPlan(
                state,
                options.targetId ?? LORA_ID,
                options
            );
        }
        if (action === 'heal') {
            return this.#rules.getHealPlan(state);
        }
        if (action === 'use-item') {
            return this.#rules.getItemUsePlan(state, options.itemId);
        }
        if (action === 'wait') {
            return this.#rules.getWaitPlan(state);
        }
        return {
            ok: false,
            action: String(action || 'unknown'),
            reason: 'unsupported-action'
        };
    }

    /** @param {object} draft @param {object} plan @param {object[]} instabilityChanges @private */
    #applyAttack(draft, plan, instabilityChanges) {
        if (plan.targetType === 'lora') {
            draft.lora.hp = plan.targetHpAfter;
            draft.lora.alive = plan.targetHpAfter > 0;
            if (plan.instabilityCalculation) {
                draft.lora.instability = plan.instabilityCalculation.after;
                instabilityChanges.push({
                    ...plan.instabilityCalculation,
                    source: 'player-attack'
                });
            }
        } else {
            const mob = draft.mobs.find(({ id }) => id === plan.targetId);
            if (mob) {
                mob.hp = plan.targetHpAfter;
                mob.alive = plan.targetHpAfter > 0;
            }
        }
        draft.consecutiveAttackCount += 1;
    }

    /** @param {object} draft @param {object} plan @param {object[]} instabilityChanges @private */
    #applyItem(draft, plan, instabilityChanges) {
        if (plan.instabilityCalculation) {
            draft.lora.instability = plan.instabilityCalculation.after;
            instabilityChanges.push({
                ...plan.instabilityCalculation,
                source: plan.effectType
            });
        }
        if (plan.peaceTurnsAfter !== null) {
            draft.lora.peaceTurns = plan.peaceTurnsAfter;
        }
        draft.extraPlayerTurns += plan.extraPlayerTurnsAdded;
        if (plan.mushroomActiveAfter !== null) {
            draft.player.mushroomActive = plan.mushroomActiveAfter;
        }
        draft.usedItems.add(plan.itemId);
        if (plan.consumeCount > 0) {
            this.#removeInventory(draft, plan.itemId, plan.consumeCount);
        }
        draft.consecutiveAttackCount = 0;
    }

    /**
     * 행동을 소비하고 턴 종료 패시브·추가 턴을 계산합니다.
     * @param {object} draft - 계산 상태입니다.
     * @param {boolean} wait - 남은 행동 전체를 포기하는지 여부입니다.
     * @param {object[]} instabilityChanges - 추가할 불안정 변화입니다.
     * @returns {boolean} 보너스 플레이어 턴이 시작됐는지 여부입니다.
     * @private
     */
    #consumeAction(draft, wait, instabilityChanges) {
        draft.actionsUsed = wait ? draft.actionsPerTurn : draft.actionsUsed + 1;
        if (draft.actionsUsed < draft.actionsPerTurn || draft.result) {
            return false;
        }
        if (this.#rules.hasItem(draft, 'mascot-costume')) {
            const calculation = this.#rules.calculateInstabilityChange({
                instability: draft.lora.instability,
                maxInstability: draft.lora.maxInstability,
                requestedChange: -toFiniteNumber(
                    this.#items['mascot-costume']?.effect?.turnEndInstabilityReduction
                ),
                hasOcarina: this.#rules.hasItem(draft, 'ocarina')
            });
            draft.lora.instability = calculation.after;
            instabilityChanges.push({ ...calculation, source: 'mascot-costume' });
        }
        if (draft.extraPlayerTurns > 0) {
            draft.extraPlayerTurns -= 1;
            draft.playerTurnSerial += 1;
            draft.turn = 'player';
            draft.phase = 'move';
            draft.movementUsed = false;
            draft.actionsUsed = 0;
            draft.actionsPerTurn = this.#rules.getActionsPerTurn(draft);
            return true;
        }
        draft.turn = 'lora';
        draft.phase = 'lora';
        return false;
    }

    /** @param {object} draft @param {string} itemId @param {number} count @private */
    #removeInventory(draft, itemId, count) {
        const next = Math.max(0, (draft.inventory.get(itemId) ?? 0) - count);
        if (next <= 0) {
            draft.inventory.delete(itemId);
        } else {
            draft.inventory.set(itemId, next);
        }
    }

    /** @param {object} draft @param {string} [targetId] @returns {object} 표시용 예상 상태입니다. @private */
    #createExpectedState(draft, targetId = null) {
        const target = draft.mobs.find(({ id }) => id === targetId);
        return {
            turn: draft.turn,
            phase: draft.phase,
            playerHp: draft.player.hp,
            loraHp: draft.lora.hp,
            instability: draft.lora.instability,
            playerAlive: draft.player.alive,
            loraAlive: draft.lora.alive,
            mushroomActive: draft.player.mushroomActive,
            peaceTurns: draft.lora.peaceTurns,
            actionsUsed: draft.actionsUsed,
            actionsPerTurn: draft.actionsPerTurn,
            actionsRemaining: Math.max(0, draft.actionsPerTurn - draft.actionsUsed),
            extraPlayerTurns: draft.extraPlayerTurns,
            playerTurnSerial: draft.playerTurnSerial,
            consecutiveAttackCount: draft.consecutiveAttackCount,
            targetHp: target?.hp ?? (targetId === LORA_ID ? draft.lora.hp : null),
            inventory: [...draft.inventory.entries()].map(([itemId, count]) => ({ itemId, count })),
            usedItems: [...draft.usedItems],
            result: draft.result ? { ...draft.result } : null
        };
    }

    /** @param {object} before @param {object} expected @param {object} plan @param {object} [extra={}] @returns {object} 변경 요약입니다. @private */
    #createChanges(before, expected, plan, extra = {}) {
        return {
            playerHp: expected.playerHp - before.playerHp,
            loraHp: expected.loraHp - before.loraHp,
            instability: expected.instability - before.instability,
            targetHp: before.targetHp === null || expected.targetHp === null
                ? null
                : expected.targetHp - before.targetHp,
            actionsRemaining: expected.actionsRemaining - before.actionsRemaining,
            extraPlayerTurns: expected.extraPlayerTurns - before.extraPlayerTurns,
            grantedExtraPlayerTurns: plan.extraPlayerTurnsAdded || 0,
            consumedItemId: plan.consumesItem ? plan.itemId : null,
            consumedItemCount: plan.consumeCount || 0,
            persistentEffects: (plan.effects || []).map((effect) => ({ ...effect })),
            bonusPlayerTurnStarted: extra.bonusPlayerTurnStarted === true,
            turnChanged: before.turn !== expected.turn || before.phase !== expected.phase,
            battleResult: expected.result ? { ...expected.result } : null
        };
    }
}

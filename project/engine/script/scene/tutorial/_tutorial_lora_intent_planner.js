const PLAYER_ID = 'player';

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
 * @class TutorialLoraIntentPlanner
 * @description 다음 로라 행동을 턴 시작 패시브까지 포함해 비변이로 결정합니다.
 */
export class TutorialLoraIntentPlanner {
    #rules;
    #lora;

    /** @param {object} config - 공통 규칙과 로라 설정입니다. */
    constructor(config = {}) {
        this.#rules = config.rules;
        this.#lora = Object.freeze({ ...(config.lora || {}) });
    }

    /**
     * 다음 로라 행동과 피해를 안정된 reason ID로 반환합니다.
     * @param {object} state - 읽기 전용 전투 상태입니다.
     * @param {{allowForecast?:boolean}} [options={}] - 플레이어 턴 현재 상태 기준 예고 허용 여부입니다.
     * @returns {object} 상태·대상·범위·피해 계산을 가진 의도입니다.
     */
    getIntent(state, options = {}) {
        const draft = this.#rules.createDraft(state);
        const currentState = this.#getInstabilityState(draft.lora.instability);
        const activeLoraTurn = draft.turn === 'lora'
            && draft.phase === 'lora'
            && !draft.result;
        const forecast = options.allowForecast === true
            && draft.turn === 'player'
            && (draft.phase === 'move' || draft.phase === 'action')
            && !draft.result;
        const base = {
            ok: false,
            reason: 'not-lora-turn',
            forecast,
            actionType: 'none',
            executionAction: 'none',
            stateId: currentState?.id ?? null,
            stateLabel: currentState?.label ?? '',
            currentStateId: currentState?.id ?? null,
            currentStateLabel: currentState?.label ?? '',
            instability: draft.lora.instability,
            expectedInstability: draft.lora.instability,
            targetId: null,
            target: null,
            affectedTiles: [],
            affectsAll: false,
            rawDamage: 0,
            passiveDamageBonus: 0,
            passiveAdjustedDamage: 0,
            damageReduction: 0,
            calculatedDamage: 0,
            finalDamage: 0,
            playerHpAfter: draft.player.hp,
            mushroomEnds: false,
            passiveChanges: [],
            damageCalculation: null
        };
        if (!activeLoraTurn && !forecast) {
            return base;
        }
        if (activeLoraTurn && draft.loraTurnPerformed) {
            return { ...base, reason: 'lora-turn-already-performed' };
        }

        const mode = forecast ? 'preview' : 'apply';
        const turnStartPlan = this.#rules.getLoraTurnStartPlan(draft, { mode });
        const passiveChanges = turnStartPlan.instabilityCalculations;
        const expectedInstability = turnStartPlan.expectedInstability;

        if (draft.lora.peaceTurns > 0) {
            const resolvedState = this.#getInstabilityState(expectedInstability);
            return {
                ...base,
                ok: true,
                reason: 'peace-active',
                executionAction: 'peace',
                stateId: resolvedState?.id ?? null,
                stateLabel: resolvedState?.label ?? '',
                expectedInstability,
                passiveChanges
            };
        }

        const resolvedState = this.#getInstabilityState(expectedInstability);
        const adjacent = this.#rules.getDistance(draft.lora, draft.player) <= this.#lora.meleeRange;
        const actionType = adjacent ? 'melee' : 'area';
        const rawDamage = adjacent
            ? toFiniteNumber(resolvedState?.meleeDamage)
            : toFiniteNumber(resolvedState?.areaDamage);
        const attackDamagePlan = this.#rules.getLoraAttackDamagePlan(
            draft,
            rawDamage,
            { mode }
        );
        const passiveDamageBonus = attackDamagePlan.passiveDamageBonus;
        const passiveAdjustedDamage = attackDamagePlan.passiveAdjustedDamage;
        if (passiveAdjustedDamage <= 0) {
            return {
                ...base,
                ok: true,
                reason: 'state-no-damage',
                executionAction: 'idle',
                stateId: resolvedState?.id ?? null,
                stateLabel: resolvedState?.label ?? '',
                expectedInstability,
                passiveChanges
            };
        }

        const damageCalculation = this.#rules.calculatePlayerDamage(
            draft,
            passiveAdjustedDamage,
            { mode }
        );
        const targetTile = cloneTile(draft.player);
        return {
            ...base,
            ok: true,
            reason: adjacent ? 'player-in-melee-range' : 'player-outside-melee-range',
            actionType,
            executionAction: actionType,
            stateId: resolvedState?.id ?? null,
            stateLabel: resolvedState?.label ?? '',
            expectedInstability,
            targetId: PLAYER_ID,
            target: { id: PLAYER_ID, tile: targetTile },
            affectedTiles: adjacent && targetTile ? [targetTile] : [],
            affectsAll: !adjacent,
            rawDamage,
            passiveDamageBonus,
            passiveAdjustedDamage,
            damageReduction: damageCalculation.reduction,
            calculatedDamage: damageCalculation.calculatedDamage,
            finalDamage: damageCalculation.finalDamage,
            playerHpAfter: damageCalculation.playerHpAfter,
            mushroomEnds: damageCalculation.mushroomEnds,
            passiveChanges,
            damageCalculation
        };
    }

    /** @param {number} value @returns {object|null} 불안정 상태입니다. @private */
    #getInstabilityState(value) {
        const normalized = this.#clamp(
            toFiniteNumber(value),
            0,
            Math.max(0, toFiniteNumber(this.#lora.maxInstability, 100))
        );
        const state = (this.#lora.instabilityStates || []).find((entry) => (
            normalized >= entry.min && normalized <= entry.max
        ));
        return state ? { ...state } : null;
    }

    /** @param {number} value @param {number} min @param {number} max @returns {number} 범위 제한값입니다. @private */
    #clamp(value, min, max) {
        return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
    }
}

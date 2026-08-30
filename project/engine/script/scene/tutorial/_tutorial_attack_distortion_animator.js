import {
    TUTORIAL_PRESENTATION_CUE_TYPES as CUE_TYPES
} from './_tutorial_presentation_contract.js';

const EFFECT_TYPE = 'spatial-distortion';

/** @param {*} value @param {number} fallback @returns {number} 유한 숫자입니다. */
function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/** @param {*} value @returns {number} 0~1 범위 값입니다. */
function clamp01(value) {
    return Math.max(0, Math.min(1, toFiniteNumber(value)));
}

/** @param {*} value @returns {{x:number,y:number}|null} 유효 타일입니다. */
function cloneTile(value) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    return Number.isFinite(x) && Number.isFinite(y)
        ? Object.freeze({ x, y })
        : null;
}

/** @param {number} progress @returns {number} 빠르게 퍼지는 expo 진행도입니다. */
function easeOutExpo(progress) {
    const normalized = clamp01(progress);
    return normalized >= 1 ? 1 : 1 - Math.pow(2, -10 * normalized);
}

/**
 * @class TutorialAttackDistortionAnimator
 * @description 플레이어 공격의 실제 impact 시각부터 퍼지는 공간 왜곡 수명을 소유합니다.
 */
export class TutorialAttackDistortionAnimator {
    #config;
    #effects;
    #nextId;
    #resolveImpactDelay;
    #destroyed;

    /**
     * @param {object} config - 플레이어 공격 왜곡 표시 데이터입니다.
     * @param {{resolveImpactDelay?:Function}} [options] - 배우 타격 프레임 조회 포트입니다.
     */
    constructor(config = {}, options = {}) {
        this.#config = config;
        this.#effects = new Map();
        this.#nextId = 0;
        this.#resolveImpactDelay = typeof options.resolveImpactDelay === 'function'
            ? options.resolveImpactDelay
            : () => 0;
        this.#destroyed = false;
    }

    /**
     * 대상 피격 cue를 실제 배우/투사체 impact 지연과 결합합니다.
     * @param {readonly object[]} cues - 프레젠터 cue입니다.
     * @param {Readonly<Record<string,number>>} effectImpactDelays - 투사체별 도착 지연입니다.
     */
    route(cues = [], effectImpactDelays = {}) {
        if (this.#destroyed || this.#config?.ENABLED === false) {
            return;
        }
        for (const cue of Array.isArray(cues) ? cues : []) {
            if (!this.#isPlayerImpactCue(cue)) {
                continue;
            }
            const actorDelay = Math.max(0, toFiniteNumber(
                this.#resolveImpactDelay(
                    cue.impactActorId,
                    cue.impactAnimationId,
                    cue.impactFacing
                )
            ));
            const projectileDelay = typeof cue.impactEffectId === 'string'
                ? Math.max(0, toFiniteNumber(effectImpactDelays[cue.impactEffectId]))
                : 0;
            const effect = this.#createEffect(cue, Math.max(actorDelay, projectileDelay));
            this.#effects.set(effect.id, effect);
        }
    }

    /** @param {number} deltaSeconds - 가변 프레임 경과 초입니다. */
    update(deltaSeconds) {
        const delta = Math.max(0, toFiniteNumber(deltaSeconds));
        if (delta <= 0 || this.#destroyed) {
            return;
        }
        for (const [id, effect] of this.#effects) {
            effect.elapsedSeconds += delta;
            if (effect.elapsedSeconds >= effect.delaySeconds + effect.durationSeconds) {
                this.#effects.delete(id);
            }
        }
    }

    /** @returns {readonly object[]} 렌더 전용 왜곡 스냅샷입니다. */
    getSnapshot() {
        if (this.#destroyed) {
            return Object.freeze([]);
        }
        return Object.freeze(Array.from(this.#effects.values()).map((effect) => {
            const activeElapsed = effect.elapsedSeconds - effect.delaySeconds;
            const progress = clamp01(activeElapsed / effect.durationSeconds);
            const intensity = Math.pow(1 - progress, effect.fadePower);
            return Object.freeze({
                id: effect.id,
                type: EFFECT_TYPE,
                targetActorId: effect.targetActorId,
                tile: effect.tile,
                visible: activeElapsed >= 0,
                progress,
                radiusProgress: easeOutExpo(progress),
                intensity,
                minRadiusTileRatio: effect.minRadiusTileRatio,
                maxRadiusTileRatio: effect.maxRadiusTileRatio,
                ringWidthTileRatio: effect.ringWidthTileRatio,
                strengthTileRatio: effect.strengthTileRatio,
                centerYOffsetTileRatio: effect.centerYOffsetTileRatio,
                alpha: effect.alpha,
                layer: effect.layer
            });
        }));
    }

    /** @returns {boolean} 예약되었거나 진행 중인 왜곡이 있는지 여부입니다. */
    isBusy() {
        return !this.#destroyed && this.#effects.size > 0;
    }

    /** 새 런에서 예약과 진행 중인 왜곡을 모두 취소합니다. */
    reset() {
        this.#effects.clear();
        this.#nextId = 0;
    }

    /** 왜곡 상태와 외부 조회 포트를 정리합니다. */
    destroy() {
        this.reset();
        this.#config = null;
        this.#resolveImpactDelay = () => 0;
        this.#destroyed = true;
    }

    /** @param {object} cue @returns {boolean} @private */
    #isPlayerImpactCue(cue) {
        return cue?.type === CUE_TYPES.ACTOR_ANIMATION
            && cue.waitForImpact === true
            && cue.impactActorId === 'player'
            && ['melee', 'ranged'].includes(cue.impactAnimationId)
            && typeof cue.actorId === 'string'
            && cue.actorId !== 'player';
    }

    /** @param {object} cue @param {number} delaySeconds @returns {object} @private */
    #createEffect(cue, delaySeconds) {
        const durationSeconds = Math.max(
            0.01,
            toFiniteNumber(this.#config?.DURATION_SECONDS, 0.28)
        );
        const baseId = typeof this.#config?.ID === 'string'
            ? this.#config.ID
            : 'player-attack-distortion';
        return {
            id: `${baseId}:${this.#nextId++}`,
            targetActorId: cue.actorId,
            tile: cloneTile(cue.tile),
            elapsedSeconds: 0,
            delaySeconds,
            durationSeconds,
            minRadiusTileRatio: Math.max(0, toFiniteNumber(
                this.#config?.MIN_RADIUS_TILE_RATIO,
                0.2
            )),
            maxRadiusTileRatio: Math.max(0, toFiniteNumber(
                this.#config?.MAX_RADIUS_TILE_RATIO,
                2.4
            )),
            ringWidthTileRatio: Math.max(0.01, toFiniteNumber(
                this.#config?.RING_WIDTH_TILE_RATIO,
                0.45
            )),
            strengthTileRatio: Math.max(0, toFiniteNumber(
                this.#config?.STRENGTH_TILE_RATIO,
                0.12
            )),
            centerYOffsetTileRatio: toFiniteNumber(
                this.#config?.CENTER_Y_OFFSET_TILE_RATIO,
                -0.28
            ),
            fadePower: Math.max(0.01, toFiniteNumber(this.#config?.FADE_POWER, 1.35)),
            alpha: clamp01(this.#config?.MAX_ALPHA ?? 1),
            layer: this.#config?.LAYER || 'effect'
        };
    }
}

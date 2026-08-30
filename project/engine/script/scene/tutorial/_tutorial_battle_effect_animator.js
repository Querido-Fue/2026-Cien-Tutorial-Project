import {
    TUTORIAL_PRESENTATION_CUE_TYPES as CUE_TYPES
} from './_tutorial_presentation_contract.js';

/** @param {*} value @param {number} fallback @returns {number} 유한 숫자입니다. */
function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/** @param {*} value @param {number} minimum @param {number} maximum @returns {number} 제한된 숫자입니다. */
function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, toFiniteNumber(value)));
}

/** @param {*} value @returns {{x:number,y:number}|null} 유효 타일입니다. */
function cloneTile(value) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    return Number.isFinite(x) && Number.isFinite(y)
        ? Object.freeze({ x, y })
        : null;
}

/**
 * @class TutorialBattleEffectAnimator
 * @description 화살 이동과 전장 폭발의 프레임, impact 지연, 취소 수명을 소유합니다.
 */
export class TutorialBattleEffectAnimator {
    #data;
    #effects;
    #nextId;
    #destroyed;

    /** @param {object} data - TUTORIAL_BATTLE_EFFECT_DATA입니다. */
    constructor(data = {}) {
        this.#data = data;
        this.#effects = new Map();
        this.#nextId = 0;
        this.#destroyed = false;
    }

    /**
     * world-animation cue를 시작하고 effect ID별 실제 충격 지연을 반환합니다.
     * @param {readonly object[]} cues - 프레젠터 cue입니다.
     * @returns {Readonly<Record<string,number>>} effect별 충격 지연 초입니다.
     */
    route(cues = []) {
        const delays = {};
        if (this.#destroyed) {
            return Object.freeze(delays);
        }
        for (const cue of Array.isArray(cues) ? cues : []) {
            if (cue?.type !== CUE_TYPES.WORLD_ANIMATION) {
                continue;
            }
            const effect = this.#createEffect(cue);
            if (!effect) {
                continue;
            }
            this.#effects.set(effect.id, effect);
            delays[effect.id] = effect.impactDelaySeconds;
        }
        return Object.freeze(delays);
    }

    /** @param {number} deltaSeconds - 가변 프레임 경과 초입니다. */
    update(deltaSeconds) {
        const delta = Math.max(0, toFiniteNumber(deltaSeconds));
        if (delta <= 0 || this.#destroyed) {
            return;
        }
        for (const [id, effect] of this.#effects) {
            effect.elapsedSeconds += delta;
            if (effect.elapsedSeconds >= effect.durationSeconds) {
                this.#effects.delete(id);
            }
        }
    }

    /** @returns {readonly object[]} 렌더 전용 효과 스냅샷입니다. */
    getSnapshot() {
        if (this.#destroyed) {
            return Object.freeze([]);
        }
        return Object.freeze(Array.from(this.#effects.values()).map((effect) => (
            effect.type === 'arrow'
                ? this.#snapshotArrow(effect)
                : this.#snapshotExplosion(effect)
        )));
    }

    /** @returns {boolean} 완료 전 월드 효과가 있는지 여부입니다. */
    isBusy() {
        return !this.#destroyed && this.#effects.size > 0;
    }

    /** 새 런에서 모든 효과를 취소합니다. */
    reset() {
        this.#effects.clear();
        this.#nextId = 0;
    }

    /** 효과와 데이터 참조를 정리합니다. */
    destroy() {
        this.reset();
        this.#destroyed = true;
        this.#data = null;
    }

    /** @param {object} cue @returns {object|null} @private */
    #createEffect(cue) {
        if (cue.animationId === this.#data?.IDS?.PLAYER_ARROW) {
            return this.#createArrow(cue);
        }
        if (cue.animationId === this.#data?.IDS?.LORA_AREA_EXPLOSION) {
            return this.#createExplosion(cue);
        }
        return null;
    }

    /** @param {object} cue @returns {object|null} @private */
    #createArrow(cue) {
        const config = this.#data?.PLAYER_ARROW;
        const from = cloneTile(cue.from);
        const to = cloneTile(cue.to);
        if (!config || !from || !to) {
            return null;
        }
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        const speed = Math.max(0.01, toFiniteNumber(config.SPEED_TILES_PER_SECOND, 1));
        const travelSeconds = clamp(
            distance / speed,
            toFiniteNumber(config.MIN_TRAVEL_SECONDS, 0.01),
            Math.max(
                toFiniteNumber(config.MIN_TRAVEL_SECONDS, 0.01),
                toFiniteNumber(config.MAX_TRAVEL_SECONDS, 1)
            )
        );
        const launchDelaySeconds = Math.max(0,
            toFiniteNumber(config.LAUNCH_FRAME)
            / Math.max(0.01, toFiniteNumber(config.SOURCE_FPS, 1))
        );
        const facing = ['left', 'up'].includes(cue.facing) ? 'left' : 'right';
        const id = this.#resolveEffectId(cue);
        return {
            id,
            type: 'arrow',
            assetId: config.ASSET_ID,
            sourceRect: config.SOURCE_RECTS?.[facing],
            from,
            to,
            elapsedSeconds: 0,
            launchDelaySeconds,
            travelSeconds,
            impactDelaySeconds: launchDelaySeconds + travelSeconds,
            durationSeconds: launchDelaySeconds + travelSeconds,
            sizeTileRatio: toFiniteNumber(config.SIZE_TILE_RATIO, 0.72),
            arcHeightTileRatio: toFiniteNumber(config.ARC_HEIGHT_TILE_RATIO, 0),
            alpha: clamp(config.MAX_ALPHA, 0, 1),
            layer: config.LAYER || 'effect'
        };
    }

    /** @param {object} cue @returns {object|null} @private */
    #createExplosion(cue) {
        const config = this.#data?.LORA_AREA_EXPLOSION;
        const frameCount = config?.FRAME_SEQUENCE?.length || 0;
        const fps = Math.max(0.01, toFiniteNumber(config?.FPS, 1));
        if (!config || frameCount === 0) {
            return null;
        }
        return {
            id: this.#resolveEffectId(cue),
            type: 'area-explosion',
            assetId: config.ASSET_ID,
            elapsedSeconds: 0,
            durationSeconds: frameCount / fps,
            impactDelaySeconds: clamp(
                toFiniteNumber(config.IMPACT_PLAYBACK_FRAME) / fps,
                0,
                frameCount / fps
            ),
            fps,
            frameWidth: toFiniteNumber(config.FRAME_WIDTH),
            frameHeight: toFiniteNumber(config.FRAME_HEIGHT),
            frameSequence: config.FRAME_SEQUENCE,
            frameAlphas: config.FRAME_ALPHAS,
            maxAlpha: clamp(config.MAX_ALPHA, 0, 1),
            alignment: config.ALIGNMENT,
            layer: config.LAYER || 'texteffect'
        };
    }

    /** @param {object} cue @returns {string} @private */
    #resolveEffectId(cue) {
        return typeof cue.effectId === 'string' && cue.effectId
            ? cue.effectId
            : `${String(cue.animationId)}:${this.#nextId++}`;
    }

    /** @param {object} effect @returns {Readonly<object>} @private */
    #snapshotArrow(effect) {
        const travelElapsed = effect.elapsedSeconds - effect.launchDelaySeconds;
        const progress = clamp(travelElapsed / effect.travelSeconds, 0, 1);
        return Object.freeze({
            id: effect.id,
            type: effect.type,
            assetId: effect.assetId,
            sourceRect: effect.sourceRect,
            from: effect.from,
            to: effect.to,
            progress,
            visible: travelElapsed >= 0,
            sizeTileRatio: effect.sizeTileRatio,
            arcHeightTileRatio: effect.arcHeightTileRatio,
            alpha: effect.alpha,
            layer: effect.layer
        });
    }

    /** @param {object} effect @returns {Readonly<object>} @private */
    #snapshotExplosion(effect) {
        const playbackIndex = Math.min(
            effect.frameSequence.length - 1,
            Math.floor(effect.elapsedSeconds * effect.fps)
        );
        const sourceFrame = effect.frameSequence[playbackIndex];
        const frameAlpha = toFiniteNumber(effect.frameAlphas?.[playbackIndex], 1);
        return Object.freeze({
            id: effect.id,
            type: effect.type,
            assetId: effect.assetId,
            sourceRect: Object.freeze({
                x: sourceFrame * effect.frameWidth,
                y: 0,
                w: effect.frameWidth,
                h: effect.frameHeight
            }),
            frameIndex: sourceFrame,
            playbackFrameIndex: playbackIndex,
            visible: true,
            alpha: clamp(frameAlpha * effect.maxAlpha, 0, 1),
            alignment: effect.alignment,
            layer: effect.layer
        });
    }
}

import {
    TUTORIAL_AUDIO_CUE_IDS as AUDIO_IDS,
    TUTORIAL_PRESENTATION_CUE_TYPES as CUE_TYPES
} from './_tutorial_presentation_contract.js';

/** @param {*} value @returns {number} 0 이상의 유한 초입니다. */
function toDelta(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

/**
 * @class TutorialSpriteCueRouter
 * @description 표현 cue를 스프라이트 명령과 타격 지연 cue로 연결합니다.
 */
export class TutorialSpriteCueRouter {
    #animator;
    #onCue;
    #scheduledAnimations;
    #destroyed;

    /** @param {{animator:object,onCue?:Function}} options - 재생기와 파생 cue 소비자입니다. */
    constructor({ animator, onCue = () => {} } = {}) {
        this.#animator = animator;
        this.#onCue = onCue;
        this.#scheduledAnimations = [];
        this.#destroyed = false;
    }

    /**
     * 배우 동작을 시작하고 타격 동기화 cue에 동일 지연 시간을 기록합니다.
     * @param {readonly object[]} cues - 프레젠터 cue입니다.
     * @returns {readonly object[]} 피드백 큐용 cue입니다.
     */
    route(cues = []) {
        const routed = [];
        for (const cue of Array.isArray(cues) ? cues : []) {
            if (!cue || typeof cue.type !== 'string') {
                continue;
            }
            const delay = cue.impactActorId && cue.impactAnimationId
                ? this.#animator?.getImpactDelay?.(
                    cue.impactActorId,
                    cue.impactAnimationId,
                    cue.impactFacing
                ) || 0
                : 0;
            if (cue.type === CUE_TYPES.ACTOR_ANIMATION && cue.actorId) {
                if (cue.waitForImpact === true && delay > 0) {
                    this.#scheduledAnimations.push({ cue, remaining: delay });
                } else {
                    this.#playCue(cue);
                }
            }
            routed.push(Object.freeze(delay > 0 && cue.type !== CUE_TYPES.ACTOR_ANIMATION
                ? { ...cue, delaySeconds: Math.max(Number(cue.delaySeconds) || 0, delay) }
                : { ...cue }));
        }
        return Object.freeze(routed);
    }

    /** 예약 동작, 프레임 재생과 발걸음 cue를 델타 시간으로 갱신합니다. */
    update(deltaSeconds) {
        if (this.#destroyed) {
            return;
        }
        const delta = toDelta(deltaSeconds);
        this.#animator?.update?.(delta);
        if (delta > 0) {
            const pending = [];
            for (const scheduled of this.#scheduledAnimations) {
                scheduled.remaining -= delta;
                if (scheduled.remaining <= 0) {
                    this.#playCue(scheduled.cue);
                } else {
                    pending.push(scheduled);
                }
            }
            this.#scheduledAnimations = pending;
        }
        for (const event of this.#animator?.drainEvents?.() || []) {
            if (event.id === 'footstep') {
                this.#onCue(Object.freeze({
                    type: CUE_TYPES.AUDIO,
                    id: AUDIO_IDS.FOOTSTEP,
                    actorId: event.actorId,
                    sourceEventType: 'sprite-footstep'
                }));
            }
        }
    }

    /** @returns {boolean} impact 예약 또는 완료 전 비루프 배우 동작이 남았는지 여부입니다. */
    isBusy() {
        return !this.#destroyed && (
            this.#scheduledAnimations.length > 0
            || this.#animator?.hasBlockingAnimation?.() === true
        );
    }

    /** 새 런 경계에서 예약과 배우 상태를 비웁니다. */
    reset() {
        this.#scheduledAnimations = [];
        this.#animator?.reset?.();
    }

    /** 장면 수명 종료 시 콜백과 하위 재생기를 정리합니다. */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        this.reset();
        this.#animator?.destroy?.();
        this.#animator = null;
        this.#onCue = () => {};
        this.#destroyed = true;
    }

    /** @param {object} cue @private */
    #playCue(cue) {
        this.#animator?.play?.(cue.actorId, cue.animationId, {
            facing: cue.facing,
            priority: cue.priority
        });
    }
}

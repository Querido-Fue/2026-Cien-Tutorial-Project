import { TutorialRecordPopupQueue } from './_tutorial_record_popup_queue.js';
import { TutorialRecordBackdropView } from './view/_tutorial_record_backdrop_view.js';

export const TUTORIAL_RECORD_POPUP_PHASES = Object.freeze({
    CLOSED: 'closed',
    OPENING: 'opening',
    OPEN: 'open',
    CLOSING: 'closing'
});

/** @param {number} value @returns {number} 0~1 범위 진행도입니다. */
function clampProgress(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

/**
 * @class TutorialRecordPopupController
 * @description 기록 대기열과 책 전환·배경 감광의 단일 팝업 수명주기를 조율합니다.
 */
export class TutorialRecordPopupController {
    #animationPort;
    #config;
    #queue;
    #backdropView;
    #onChange;
    #state;
    #generation;
    #ownedAnimationIds;
    #destroyed;

    /**
     * @param {object} options - 애니메이션·표현 설정과 테스트 대역입니다.
     */
    constructor({
        animationPort = {},
        config = {},
        queue = new TutorialRecordPopupQueue(),
        backdropView = new TutorialRecordBackdropView(config.BACKDROP),
        onChange = () => {}
    } = {}) {
        this.#animationPort = animationPort;
        this.#config = Object.freeze({ ...config });
        this.#queue = queue;
        this.#backdropView = backdropView;
        this.#onChange = onChange;
        this.#state = {
            phase: TUTORIAL_RECORD_POPUP_PHASES.CLOSED,
            progress: 0,
            revision: 0
        };
        this.#generation = 0;
        this.#ownedAnimationIds = new Set();
        this.#destroyed = false;
    }

    /** @param {readonly *[]} ids @returns {number} 새로 대기시킨 기록 수입니다. */
    enqueue(ids = []) {
        return this.#queue.enqueue(ids);
    }

    /** @returns {boolean} 활성 또는 대기 기록이 있는지 여부입니다. */
    hasWork() {
        return this.#queue.hasWork();
    }

    /** @returns {string|null} 현재 표시 중인 기록 ID입니다. */
    getActiveId() {
        return this.#queue.getActiveId();
    }

    /** @returns {boolean} 진입·퇴장 중 입력이 잠겼는지 여부입니다. */
    isLocked() {
        return this.#state.phase === TUTORIAL_RECORD_POPUP_PHASES.OPENING
            || this.#state.phase === TUTORIAL_RECORD_POPUP_PHASES.CLOSING;
    }

    /** @returns {Readonly<object>} 책·페이지·배경이 공유하는 표시 snapshot입니다. */
    getSnapshot() {
        const progress = clampProgress(this.#state.progress);
        const minimumScale = Math.max(
            0.1,
            Math.min(1, Number(this.#config.MIN_SCALE) || 0.72)
        );
        const revealStart = Math.max(
            0,
            Math.min(0.95, Number(this.#config.CONTENT_REVEAL_START) || 0)
        );
        const contentProgress = clampProgress(
            (progress - revealStart) / Math.max(0.05, 1 - revealStart)
        );
        return Object.freeze({
            phase: this.#state.phase,
            progress,
            alpha: progress,
            scale: minimumScale + ((1 - minimumScale) * progress),
            pageProgress: progress,
            contentAlpha: progress * contentProgress,
            visible: this.#state.phase !== TUTORIAL_RECORD_POPUP_PHASES.CLOSED,
            interactive: this.#state.phase === TUTORIAL_RECORD_POPUP_PHASES.OPEN,
            revision: this.#state.revision
        });
    }

    /**
     * 다른 화면 전환과 기록 버튼의 표시·입력 상태를 결합합니다.
     * @param {{alpha?:number,interactive?:boolean}} base - 기존 버튼 표시 상태입니다.
     * @param {boolean} active - 현재 기록 팝업 모드인지 여부입니다.
     * @returns {{alpha:number,interactive:boolean}} 통합 버튼 표시 상태입니다.
     */
    createButtonPresentation(base = {}, active = true) {
        if (!active) {
            return base;
        }
        const snapshot = this.getSnapshot();
        const baseAlpha = Number(base.alpha);
        return Object.freeze({
            alpha: (Number.isFinite(baseAlpha) ? baseAlpha : 1) * snapshot.contentAlpha,
            interactive: base.interactive !== false && snapshot.interactive
        });
    }

    /** 현재 진행도로 게임 장면 위 vignette backdrop을 갱신합니다. */
    syncBackdrop() {
        this.#backdropView.sync(this.getSnapshot());
    }

    /**
     * 선택 가능한 다음 기록을 활성화하고 0.6초 진입 전환을 시작합니다.
     * @param {Function} selectEntry - 기록 ID를 목표 페이지로 선택하는 함수입니다.
     * @returns {boolean} 기록을 열었는지 여부입니다.
     */
    openNext(selectEntry) {
        if (this.#destroyed
            || this.#state.phase !== TUTORIAL_RECORD_POPUP_PHASES.CLOSED
            || typeof selectEntry !== 'function') {
            return false;
        }
        let recordId = this.#queue.openNext();
        while (recordId) {
            if (selectEntry(recordId) === true) {
                const generation = ++this.#generation;
                void this.#runOpen(generation).catch(
                    (error) => this.#handleTransitionError(generation, error)
                );
                return true;
            }
            this.#queue.closeActive();
            recordId = this.#queue.openNext();
        }
        return false;
    }

    /**
     * 현재 책을 0.4초 역순으로 닫고 완료 뒤 활성 기록을 소비합니다.
     * @param {Function} [onClosed] - 퇴장 완료 callback입니다.
     * @returns {boolean} 닫기 시작 여부입니다.
     */
    close(onClosed = () => {}) {
        if (this.#destroyed
            || this.#state.phase !== TUTORIAL_RECORD_POPUP_PHASES.OPEN) {
            return false;
        }
        const generation = ++this.#generation;
        void this.#runClose(generation, onClosed).catch(
            (error) => this.#handleTransitionError(generation, error)
        );
        return true;
    }

    /** 활성·대기 기록과 진행 중 애니메이션을 초기 상태로 되돌립니다. */
    clear() {
        this.#generation += 1;
        this.#cancelAnimations();
        this.#queue.clear();
        this.#setPhase(TUTORIAL_RECORD_POPUP_PHASES.CLOSED, 0);
        this.#backdropView.clear();
    }

    /** 팝업이 소유한 애니메이션·DOM 표현·대기열을 정리합니다. */
    destroy() {
        this.clear();
        this.#destroyed = true;
        this.#backdropView.destroy();
        this.#onChange = () => {};
    }

    /** @param {number} generation @returns {Promise<void>} @private */
    async #runOpen(generation) {
        this.#setPhase(TUTORIAL_RECORD_POPUP_PHASES.OPENING, 0);
        await this.#animateProgress({
            startValue: 0,
            endValue: 1,
            duration: this.#config.OPEN_SECONDS,
            type: this.#config.OPEN_EASING || 'easeOutExpo'
        });
        if (this.#isCurrent(generation)) {
            this.#setPhase(TUTORIAL_RECORD_POPUP_PHASES.OPEN, 1);
        }
    }

    /** @param {number} generation @param {Function} onClosed @returns {Promise<void>} @private */
    async #runClose(generation, onClosed) {
        this.#setPhase(
            TUTORIAL_RECORD_POPUP_PHASES.CLOSING,
            this.#state.progress
        );
        await this.#animateProgress({
            startValue: this.#state.progress,
            endValue: 0,
            duration: this.#config.CLOSE_SECONDS,
            type: this.#config.CLOSE_EASING || 'easeInExpo'
        });
        if (!this.#isCurrent(generation)) {
            return;
        }
        const closedId = this.#queue.closeActive();
        this.#setPhase(TUTORIAL_RECORD_POPUP_PHASES.CLOSED, 0);
        this.#backdropView.clear();
        onClosed(closedId);
    }

    /** @param {object} spec @returns {Promise<void>} @private */
    #animateProgress(spec) {
        let animation = null;
        try {
            animation = this.#animationPort.animate?.(this.#state, {
                variable: 'progress',
                startValue: spec.startValue,
                endValue: spec.endValue,
                duration: Math.max(0, Number(spec.duration) || 0),
                type: spec.type
            });
        } catch {
            animation = null;
        }
        if (!animation || !Number.isInteger(animation.id) || animation.id < 0) {
            this.#state.progress = spec.endValue;
            return Promise.resolve();
        }
        this.#ownedAnimationIds.add(animation.id);
        return Promise.resolve(animation.promise).finally(() => {
            this.#ownedAnimationIds.delete(animation.id);
        });
    }

    /** @param {string} phase @param {number} progress @private */
    #setPhase(phase, progress) {
        const changed = this.#state.phase !== phase;
        this.#state.phase = phase;
        this.#state.progress = clampProgress(progress);
        if (changed) {
            this.#state.revision += 1;
        }
        this.#onChange(this.getSnapshot());
    }

    /** @returns {void} 진행 중인 표준 애니메이션을 모두 완료·회수합니다. @private */
    #cancelAnimations() {
        for (const animationId of this.#ownedAnimationIds) {
            this.#animationPort.remove?.(animationId);
        }
        this.#ownedAnimationIds.clear();
    }

    /** @param {number} generation @returns {boolean} 현재 유효한 전환인지 여부입니다. @private */
    #isCurrent(generation) {
        return !this.#destroyed && generation === this.#generation;
    }

    /** @param {number} generation @param {*} error @private */
    #handleTransitionError(generation, error) {
        if (!this.#isCurrent(generation)) {
            return;
        }
        console.error('기록 팝업 전환 오류:', error);
        this.clear();
    }
}

/**
 * @class TutorialGalleryPageTurnController
 * @description 갤러리 페이지 전환 진행도·이전 내용·GPU 캡처 수명을 관리합니다.
 */
export class TutorialGalleryPageTurnController {
    #animationPort;
    #surfacePort;
    #config;
    #onChange;
    #state;
    #animationId;
    #generation;
    #destroyed;

    /** @param {object} options - 애니메이션·surface 포트와 정적 설정입니다. */
    constructor({
        animationPort = {},
        surfacePort = {},
        config = {},
        onChange = () => {}
    } = {}) {
        this.#animationPort = animationPort;
        this.#surfacePort = surfacePort;
        this.#config = config;
        this.#onChange = onChange;
        this.#state = this.#createIdleState(0);
        this.#animationId = null;
        this.#generation = 0;
        this.#destroyed = false;
    }

    /**
     * 이전 내용만 보관하고 전환 진행도를 0에서 1로 재생합니다.
     * UI가 지워진 입력 단계에서는 캡처하지 않고 실제 draw 단계까지 지연합니다.
     * @param {object} options - 이전 갤러리 상태·방향·WebGL 사용 여부입니다.
     * @returns {boolean} 전환 시작 여부입니다.
     */
    start({ previousGallery, direction = 1, useWebGL = true } = {}) {
        if (this.#destroyed || this.#state.active || !previousGallery) {
            return false;
        }
        const generation = ++this.#generation;
        this.#surfacePort.clear?.();
        this.#state = {
            active: true,
            progress: 0,
            direction: Number(direction) < 0 ? -1 : 1,
            previousGallery,
            webglAvailable: useWebGL === true,
            revision: this.#state.revision + 1
        };
        this.#onChange();

        const duration = Math.max(0, Number(this.#config.PAGE_TURN_SECONDS) || 0);
        let animation = null;
        try {
            animation = this.#animationPort.animate?.(this.#state, {
                variable: 'progress',
                startValue: 0,
                endValue: 1,
                duration,
                type: this.#config.EASING || 'easeInOutCubic'
            });
        } catch (_error) {
            animation = null;
        }
        if (!animation || !Number.isInteger(animation.id) || animation.id < 0) {
            this.#finish(generation);
            return true;
        }
        this.#animationId = animation.id;
        Promise.resolve(animation.promise).then(
            () => this.#finish(generation),
            () => this.#finish(generation)
        );
        return true;
    }

    /** @returns {boolean} 전환 입력 잠금 여부입니다. */
    isActive() {
        return this.#state.active === true;
    }

    /** @returns {Readonly<object>} 직렬화 가능한 페이지 전환 상태입니다. */
    getSnapshot() {
        return Object.freeze({ ...this.#state });
    }

    /**
     * 현재 캡처 텍스처를 포함해 WebGL 페이지 명령을 제출합니다.
     * @param {object} command - 페이지 컬 명령입니다.
     * @param {object} frames - 이전·다음 내용을 그리는 포트와 뷰포트입니다.
     * @returns {boolean} WebGL 명령 제출 여부입니다.
     */
    renderPageTurn(command, frames) {
        if (!this.#state.active || !this.#state.webglAvailable) {
            return false;
        }
        const submitted = this.#surfacePort.submit?.(command, frames) === true;
        if (!submitted) {
            this.#state.webglAvailable = false;
            this.#state.revision += 1;
            this.#onChange();
        }
        return submitted;
    }

    /** 진행 중인 페이지 전환과 캡처를 즉시 정리합니다. */
    cancel() {
        this.#generation += 1;
        const animationId = this.#animationId;
        this.#animationId = null;
        if (Number.isInteger(animationId) && animationId >= 0) {
            this.#animationPort.remove?.(animationId);
        }
        const revision = this.#state.revision + (this.#state.active ? 1 : 0);
        this.#state = this.#createIdleState(revision);
        this.#surfacePort.clear?.();
        this.#onChange();
    }

    /** 애니메이션과 동적 WebGL surface를 함께 회수합니다. */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        this.cancel();
        this.#surfacePort.destroy?.();
        this.#onChange = () => {};
        this.#destroyed = true;
    }

    /** @param {number} generation - 시작 세대입니다. @private */
    #finish(generation) {
        if (this.#destroyed || generation !== this.#generation) {
            return;
        }
        const revision = this.#state.revision + 1;
        this.#animationId = null;
        this.#state = this.#createIdleState(revision);
        this.#surfacePort.clear?.();
        this.#onChange();
    }

    /** @param {number} revision @returns {object} 기본 전환 상태입니다. @private */
    #createIdleState(revision) {
        return {
            active: false,
            progress: 1,
            direction: 1,
            previousGallery: null,
            webglAvailable: false,
            revision: Math.max(0, Math.trunc(Number(revision)) || 0)
        };
    }
}

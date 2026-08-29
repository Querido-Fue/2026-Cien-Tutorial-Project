/** @param {number} value @returns {string} CSS에 사용할 짧은 소수 문자열입니다. */
function formatCssNumber(value) {
    return String(Number(Number(value).toFixed(3)));
}

/**
 * @class TutorialRecordBackdropView
 * @description 기록 책 아래의 기존 게임 레이어에 블러·감광을 적용하고 원래 스타일을 복원합니다.
 */
export class TutorialRecordBackdropView {
    #config;
    #getElementById;
    #element;
    #originalStyle;

    /**
     * @param {object} config - 블러 대상과 강도 설정입니다.
     * @param {Function} [getElementById] - 테스트 가능한 DOM 조회 포트입니다.
     */
    constructor(config = {}, getElementById = null) {
        this.#config = Object.freeze({ ...config });
        this.#getElementById = typeof getElementById === 'function'
            ? getElementById
            : (id) => globalThis.document?.getElementById?.(id) || null;
        this.#element = null;
        this.#originalStyle = null;
    }

    /**
     * 전환 진행도에 맞춰 하위 게임 장면의 CSS backdrop 효과를 갱신합니다.
     * @param {{visible?:boolean,progress?:number}} snapshot - 기록 전환 표시 상태입니다.
     */
    sync(snapshot = {}) {
        const progress = snapshot.visible === true
            ? Math.max(0, Math.min(1, Number(snapshot.progress) || 0))
            : 0;
        if (progress <= 0) {
            this.clear();
            return;
        }
        const element = this.#resolveElement();
        if (!element?.style) {
            return;
        }
        this.#captureOriginalStyle(element.style);
        const blur = Math.max(0, Number(this.#config.BLUR_PX) || 0) * progress;
        const targetBrightness = Math.max(
            0,
            Math.min(1, Number(this.#config.BRIGHTNESS) || 0)
        );
        const brightness = 1 - ((1 - targetBrightness) * progress);
        const dimAlpha = Math.max(
            0,
            Math.min(1, Number(this.#config.DIM_ALPHA) || 0)
        ) * progress;
        const filter = `blur(${formatCssNumber(blur)}px) brightness(${formatCssNumber(brightness)})`;
        element.style.webkitBackdropFilter = filter;
        element.style.backdropFilter = filter;
        element.style.backgroundColor = `rgba(5, 3, 8, ${formatCssNumber(dimAlpha)})`;
        element.style.willChange = 'backdrop-filter, background-color';
    }

    /** 기록 팝업이 닫히면 vignette surface의 기존 inline style을 정확히 복원합니다. */
    clear() {
        if (!this.#element?.style || !this.#originalStyle) {
            return;
        }
        Object.assign(this.#element.style, this.#originalStyle);
        this.#originalStyle = null;
    }

    /** DOM 스타일과 참조를 정리합니다. */
    destroy() {
        this.clear();
        this.#element = null;
        this.#getElementById = () => null;
    }

    /** @returns {object|null} 블러를 담당할 vignette 요소입니다. @private */
    #resolveElement() {
        if (!this.#element) {
            this.#element = this.#getElementById(
                String(this.#config.ELEMENT_ID || 'vignette')
            );
        }
        return this.#element;
    }

    /** @param {object} style - 복원할 CSSStyleDeclaration입니다. @private */
    #captureOriginalStyle(style) {
        if (this.#originalStyle) {
            return;
        }
        this.#originalStyle = Object.freeze({
            webkitBackdropFilter: style.webkitBackdropFilter || '',
            backdropFilter: style.backdropFilter || '',
            backgroundColor: style.backgroundColor || '',
            willChange: style.willChange || ''
        });
    }
}

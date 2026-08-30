const HOST_ID = 'tutorial-record-backdrop';

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
    #document;
    #anchor;
    #host;

    /**
     * @param {object} config - 블러 대상과 강도 설정입니다.
     * @param {Document|null} [documentRef] - 테스트 가능한 DOM 포트입니다.
     */
    constructor(config = {}, documentRef = globalThis.document || null) {
        this.#config = Object.freeze({ ...config });
        this.#document = documentRef;
        this.#anchor = null;
        this.#host = null;
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
        const anchor = this.#resolveAnchor();
        const bounds = anchor?.getBoundingClientRect?.();
        const host = this.#ensureHost();
        if (!host?.style || !(bounds?.width > 0) || !(bounds?.height > 0)) {
            this.clear();
            return;
        }
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
        host.style.display = 'block';
        host.style.left = `${formatCssNumber(bounds.left)}px`;
        host.style.top = `${formatCssNumber(bounds.top)}px`;
        host.style.width = `${formatCssNumber(bounds.width)}px`;
        host.style.height = `${formatCssNumber(bounds.height)}px`;
        host.style.webkitBackdropFilter = filter;
        host.style.backdropFilter = filter;
        host.style.backgroundColor = `rgba(5, 3, 8, ${formatCssNumber(dimAlpha)})`;
        host.style.willChange = 'backdrop-filter, background-color';
    }

    /** 기록 팝업이 닫히면 전용 backdrop을 숨기고 합성 효과를 제거합니다. */
    clear() {
        if (!this.#host?.style) {
            return;
        }
        this.#host.style.display = 'none';
        this.#host.style.webkitBackdropFilter = '';
        this.#host.style.backdropFilter = '';
        this.#host.style.backgroundColor = 'transparent';
        this.#host.style.willChange = '';
    }

    /** DOM 스타일과 참조를 정리합니다. */
    destroy() {
        this.clear();
        this.#host?.remove?.();
        this.#host = null;
        this.#anchor = null;
        this.#document = null;
    }

    /** @returns {HTMLElement|null} 게임 화면과 같은 경계를 제공하는 요소입니다. @private */
    #resolveAnchor() {
        if (!this.#anchor) {
            this.#anchor = this.#document?.getElementById?.(
                String(this.#config.ELEMENT_ID || 'vignette')
            ) || null;
        }
        return this.#anchor;
    }

    /** @returns {HTMLElement|null} 책 아래에 놓이는 전용 블러 계층입니다. @private */
    #ensureHost() {
        if (this.#host && this.#host.isConnected !== false) {
            return this.#host;
        }
        if (!this.#document?.body?.appendChild || !this.#document?.createElement) {
            return null;
        }
        this.#document.getElementById?.(HOST_ID)?.remove?.();
        const host = this.#document.createElement('div');
        host.id = HOST_ID;
        host.className = 'tutorial-record-backdrop';
        host.setAttribute?.('aria-hidden', 'true');
        this.#document.body.appendChild(host);
        this.#host = host;
        return host;
    }
}

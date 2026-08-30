const HOST_ID = 'tutorial-guidance-focus-backdrop';
const RADIAL_MASK_STOPS = Object.freeze([
    Object.freeze({ ratio: 0.14, alpha: 0.04 }),
    Object.freeze({ ratio: 0.32, alpha: 0.18 }),
    Object.freeze({ ratio: 0.5, alpha: 0.5 }),
    Object.freeze({ ratio: 0.68, alpha: 0.82 }),
    Object.freeze({ ratio: 0.86, alpha: 0.96 })
]);

/** @param {number} value @param {number} min @param {number} max */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
}

/** @param {number} value @returns {string} */
function formatCssNumber(value) {
    const rounded = Math.round((Number(value) || 0) * 1000) / 1000;
    return String(Object.is(rounded, -0) ? 0 : rounded);
}

/**
 * @class TutorialGuidanceBackdropView
 * @description UI 아래 내용을 선택 영역만 남기고 흐리는 DOM backdrop 계층입니다.
 */
export class TutorialGuidanceBackdropView {
    #config;
    #document;
    #host;
    #panel;

    /** @param {object} config @param {Document|null} documentRef */
    constructor(config = {}, documentRef = globalThis.document || null) {
        this.#config = config;
        this.#document = documentRef;
        this.#host = null;
        this.#panel = null;
    }

    /**
     * 현재 캔버스와 논리 포커스 사각형을 CSS 픽셀 계층에 동기화합니다.
     * @param {{visible?:boolean,blurProgress?:number,focusRect?:object,viewport?:object}} state
     */
    sync(state = {}) {
        const progress = clamp(state.blurProgress, 0, 1);
        if (state.visible !== true || progress <= 0 || !state.focusRect) {
            this.clear();
            return;
        }
        const host = this.#ensureHost();
        const canvas = this.#document?.getElementById?.('ui');
        const bounds = canvas?.getBoundingClientRect?.();
        if (!host || !(bounds?.width > 0) || !(bounds?.height > 0)) {
            this.clear();
            return;
        }

        host.style.display = 'block';
        host.style.left = `${bounds.left}px`;
        host.style.top = `${bounds.top}px`;
        host.style.width = `${bounds.width}px`;
        host.style.height = `${bounds.height}px`;

        const logicalWidth = Math.max(1, Number(state.viewport?.WW) || canvas.width || 1);
        const logicalHeight = Math.max(1, Number(state.viewport?.WH) || canvas.height || 1);
        const scaleX = bounds.width / logicalWidth;
        const scaleY = bounds.height / logicalHeight;
        const focus = state.focusRect;
        const left = clamp(Number(focus.x) * scaleX, 0, bounds.width);
        const top = clamp(Number(focus.y) * scaleY, 0, bounds.height);
        const right = clamp(
            (Number(focus.x) + Number(focus.w)) * scaleX,
            left,
            bounds.width
        );
        const bottom = clamp(
            (Number(focus.y) + Number(focus.h)) * scaleY,
            top,
            bounds.height
        );
        const blurPx = Math.max(0, Number(this.#config.MAX_BLUR_PX) || 8)
            * progress;
        const requestedBrightness = Number(this.#config.MIN_BRIGHTNESS);
        const minimumBrightness = clamp(
            Number.isFinite(requestedBrightness) ? requestedBrightness : 0.84,
            0,
            1
        );
        const brightness = 1 - ((1 - minimumBrightness) * progress);
        const dimAlpha = clamp(this.#config.DIM_ALPHA, 0, 1) * progress;
        const feather = Math.max(
            0,
            Number(this.#config.FOCUS_FEATHER_CSS_PX) || 18
        );
        const visual = Object.freeze({ blurPx, brightness, dimAlpha });
        const halfWidth = Math.max(0, right - left) * 0.5;
        const halfHeight = Math.max(0, bottom - top) * 0.5;
        this.#placePanel(visual, {
            centerX: left + halfWidth,
            centerY: top + halfHeight,
            radius: Math.hypot(halfWidth, halfHeight),
            feather
        });
    }

    /** 현재 backdrop만 즉시 숨깁니다. */
    clear() {
        if (this.#host) {
            this.#host.style.display = 'none';
        }
    }

    /** 장면 수명 종료 시 동적 DOM을 제거합니다. */
    destroy() {
        this.#host?.remove?.();
        this.#host = null;
        this.#panel = null;
    }

    /** @returns {HTMLElement|null} @private */
    #ensureHost() {
        if (this.#host && this.#host.isConnected !== false) {
            return this.#host;
        }
        if (!this.#document?.body?.appendChild || !this.#document?.createElement) {
            return null;
        }
        const existing = this.#document.getElementById?.(HOST_ID);
        if (existing) {
            existing.remove?.();
        }
        const host = this.#document.createElement('div');
        host.id = HOST_ID;
        host.className = 'tutorial-guidance-focus-backdrop';
        const panel = this.#document.createElement('div');
        panel.className = 'tutorial-guidance-focus-panel is-radial';
        host.appendChild(panel);
        this.#document.body.appendChild(host);
        this.#host = host;
        this.#panel = panel;
        return host;
    }

    /** @private */
    #placePanel(visual, focus) {
        const panel = this.#panel;
        if (!panel) {
            return;
        }
        panel.style.display = 'block';
        panel.style.left = '0';
        panel.style.top = '0';
        panel.style.width = '100%';
        panel.style.height = '100%';
        panel.style.backgroundColor = `rgba(7, 3, 10, ${visual.dimAlpha})`;
        const filter = `blur(${formatCssNumber(visual.blurPx)}px) brightness(${formatCssNumber(visual.brightness)})`;
        panel.style.backdropFilter = filter;
        panel.style.webkitBackdropFilter = filter;
        const mask = this.#createRadialMask(focus);
        panel.style.maskImage = mask;
        panel.style.webkitMaskImage = mask;
        panel.style.maskMode = 'alpha';
        panel.style.maskRepeat = 'no-repeat';
        panel.style.webkitMaskRepeat = 'no-repeat';
    }

    /** @private */
    #createRadialMask(focus) {
        const centerX = Math.max(0, Number(focus.centerX) || 0);
        const centerY = Math.max(0, Number(focus.centerY) || 0);
        const radius = Math.max(0, Number(focus.radius) || 0);
        const feather = Math.max(0, Number(focus.feather) || 0);
        const center = `${formatCssNumber(centerX)}px ${formatCssNumber(centerY)}px`;
        const innerRadius = `${formatCssNumber(radius)}px`;
        if (feather <= 0.5) {
            return `radial-gradient(circle at ${center}, transparent 0, transparent ${innerRadius}, #000 ${innerRadius}, #000 100%)`;
        }
        const transitionStops = RADIAL_MASK_STOPS.map(({ ratio, alpha }) => {
            const stopRadius = formatCssNumber(radius + (feather * ratio));
            return `rgba(0, 0, 0, ${alpha}) ${stopRadius}px`;
        });
        const outerRadius = formatCssNumber(radius + feather);
        return [
            `radial-gradient(circle at ${center}`,
            'transparent 0',
            `transparent ${innerRadius}`,
            ...transitionStops,
            `#000 ${outerRadius}px`,
            '#000 100%)'
        ].join(', ');
    }
}

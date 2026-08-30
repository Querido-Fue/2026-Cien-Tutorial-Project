const HOST_ID = 'tutorial-guidance-focus-backdrop';
const PANEL_NAMES = Object.freeze(['top', 'bottom', 'left', 'right']);

/** @param {number} value @param {number} min @param {number} max */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
}

/**
 * @class TutorialGuidanceBackdropView
 * @description UI 아래 내용을 선택 영역만 남기고 흐리는 DOM backdrop 계층입니다.
 */
export class TutorialGuidanceBackdropView {
    #config;
    #document;
    #host;
    #panels;

    /** @param {object} config @param {Document|null} documentRef */
    constructor(config = {}, documentRef = globalThis.document || null) {
        this.#config = config;
        this.#document = documentRef;
        this.#host = null;
        this.#panels = Object.create(null);
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

        this.#placePanel('top', 0, 0, bounds.width, top, visual, {
            direction: 'bottom', feather
        });
        this.#placePanel(
            'bottom',
            0,
            bottom,
            bounds.width,
            bounds.height - bottom,
            visual,
            { direction: 'top', feather }
        );
        this.#placePanel('left', 0, top, left, bottom - top, visual, {
            direction: 'right', feather
        });
        this.#placePanel(
            'right',
            right,
            top,
            bounds.width - right,
            bottom - top,
            visual,
            { direction: 'left', feather }
        );
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
        this.#panels = Object.create(null);
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
        for (const name of PANEL_NAMES) {
            const panel = this.#document.createElement('div');
            panel.className = `tutorial-guidance-focus-panel is-${name}`;
            host.appendChild(panel);
            this.#panels[name] = panel;
        }
        this.#document.body.appendChild(host);
        this.#host = host;
        return host;
    }

    /** @private */
    #placePanel(name, x, y, width, height, visual, edge) {
        const panel = this.#panels[name];
        if (!panel) {
            return;
        }
        const safeWidth = Math.max(0, width);
        const safeHeight = Math.max(0, height);
        if (safeWidth < 0.5 || safeHeight < 0.5) {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = 'block';
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
        panel.style.width = `${safeWidth}px`;
        panel.style.height = `${safeHeight}px`;
        panel.style.backgroundColor = `rgba(7, 3, 10, ${visual.dimAlpha})`;
        const filter = `blur(${visual.blurPx}px) brightness(${visual.brightness})`;
        panel.style.backdropFilter = filter;
        panel.style.webkitBackdropFilter = filter;
        const mask = this.#createFeatherMask(edge.direction, edge.feather, {
            width: safeWidth,
            height: safeHeight
        });
        panel.style.maskImage = mask;
        panel.style.webkitMaskImage = mask;
    }

    /** @private */
    #createFeatherMask(direction, requestedFeather, size) {
        const vertical = direction === 'top' || direction === 'bottom';
        const length = vertical ? size.height : size.width;
        const feather = Math.min(length, Math.max(0, requestedFeather));
        if (feather <= 0.5) {
            return 'linear-gradient(#000, #000)';
        }
        const solidStop = Math.max(0, length - feather);
        if (direction === 'bottom') {
            return `linear-gradient(to bottom, #000 0, #000 ${solidStop}px, transparent ${length}px)`;
        }
        if (direction === 'top') {
            return `linear-gradient(to bottom, transparent 0, #000 ${feather}px, #000 100%)`;
        }
        if (direction === 'right') {
            return `linear-gradient(to right, #000 0, #000 ${solidStop}px, transparent ${length}px)`;
        }
        return `linear-gradient(to right, transparent 0, #000 ${feather}px, #000 100%)`;
    }
}

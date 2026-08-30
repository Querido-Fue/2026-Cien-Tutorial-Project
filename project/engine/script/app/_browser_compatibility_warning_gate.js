import { isNwRuntime } from '../util/nw_bridge.js';

const PRIMARY_MOUSE_BUTTON = 0;
const CAPTURE_LISTENER_OPTIONS = Object.freeze({ capture: true });
const CHROMIUM_BRAND_PATTERN = /(?:Chromium|Google Chrome|Microsoft Edge|Opera|Brave)/i;
const CHROMIUM_USER_AGENT_PATTERN = /(?:Chrome|Chromium|EdgA?|OPR|Vivaldi|YaBrowser|SamsungBrowser)\//i;
const IOS_ALTERNATE_ENGINE_PATTERN = /(?:CriOS|EdgiOS|OPiOS)\//i;

/**
 * 현재 실행 환경이 NW.js 또는 Chromium 엔진 기반인지 판정합니다.
 * @param {{navigatorRef?:Navigator|null,nwRuntimeCheck?:Function}} [options={}] - 테스트 가능한 런타임 포트입니다.
 * @returns {boolean} 게임의 권장 런타임이면 true입니다.
 */
export function isRecommendedGameRuntime(options = {}) {
    const nwRuntimeCheck = typeof options.nwRuntimeCheck === 'function'
        ? options.nwRuntimeCheck
        : isNwRuntime;
    if (nwRuntimeCheck()) {
        return true;
    }

    const navigatorRef = options.navigatorRef ?? globalThis.navigator ?? null;
    const brands = Array.isArray(navigatorRef?.userAgentData?.brands)
        ? navigatorRef.userAgentData.brands
        : [];
    if (brands.some((entry) => CHROMIUM_BRAND_PATTERN.test(String(entry?.brand || '')))) {
        return true;
    }

    const userAgent = String(navigatorRef?.userAgent || '');
    if (IOS_ALTERNATE_ENGINE_PATTERN.test(userAgent)) {
        return false;
    }
    return CHROMIUM_USER_AGENT_PATTERN.test(userAgent);
}

/**
 * @class BrowserCompatibilityWarningGate
 * @description 비권장 브라우저의 첫 주 클릭 뒤 호환성 경고를 한 번만 엽니다.
 */
export class BrowserCompatibilityWarningGate {
    #window;
    #navigator;
    #overlayPort;
    #nwRuntimeCheck;
    #schedule;
    #armed;
    #handled;
    #boundMouseDown;

    /**
     * @param {{windowRef?:Window|null,navigatorRef?:Navigator|null,overlayPort?:object|null,nwRuntimeCheck?:Function,schedule?:Function}} [options={}] - DOM·런타임·오버레이 포트입니다.
     */
    constructor(options = {}) {
        this.#window = options.windowRef ?? globalThis.window ?? null;
        this.#navigator = options.navigatorRef ?? globalThis.navigator ?? null;
        this.#overlayPort = options.overlayPort || null;
        this.#nwRuntimeCheck = typeof options.nwRuntimeCheck === 'function'
            ? options.nwRuntimeCheck
            : isNwRuntime;
        this.#schedule = typeof options.schedule === 'function'
            ? options.schedule
            : (callback) => globalThis.setTimeout(callback, 0);
        this.#armed = false;
        this.#handled = false;
        this.#boundMouseDown = this.#handleMouseDown.bind(this);
    }

    /**
     * 비권장 환경에서 첫 주 클릭을 기다리기 시작합니다.
     * @returns {boolean} 실제로 클릭 감시를 시작했으면 true입니다.
     */
    arm() {
        if (this.#armed || this.#handled) {
            return false;
        }
        if (isRecommendedGameRuntime({
            navigatorRef: this.#navigator,
            nwRuntimeCheck: this.#nwRuntimeCheck
        })) {
            this.#handled = true;
            return false;
        }
        if (typeof this.#window?.addEventListener !== 'function') {
            this.#handled = true;
            return false;
        }

        this.#armed = true;
        this.#window.addEventListener(
            'mousedown',
            this.#boundMouseDown,
            CAPTURE_LISTENER_OPTIONS
        );
        return true;
    }

    /** 첫 클릭 감시를 해제합니다. */
    destroy() {
        this.#disarm();
        this.#handled = true;
        this.#overlayPort = null;
    }

    /** @param {MouseEvent} event @private */
    #handleMouseDown(event) {
        if (Number(event?.button) !== PRIMARY_MOUSE_BUTTON) {
            return;
        }
        this.#handled = true;
        this.#disarm();
        this.#schedule(() => {
            this.#overlayPort?.openBrowserCompatibilityWarningOverlay?.();
        });
    }

    /** @private */
    #disarm() {
        if (!this.#armed) {
            return;
        }
        this.#window?.removeEventListener?.(
            'mousedown',
            this.#boundMouseDown,
            CAPTURE_LISTENER_OPTIONS
        );
        this.#armed = false;
    }
}

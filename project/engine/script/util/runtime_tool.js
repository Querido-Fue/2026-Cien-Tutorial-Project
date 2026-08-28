import { isNwRuntime, nw } from './nw_bridge.js';
import { clampFiniteNumber, resolveFiniteNumber } from './number_util.js';

let runtimeToolInstance = null;

/**
 * @class RuntimeTool
 * @description NW.js와 웹 브라우저의 창 및 외부 연동 기능을 제공합니다.
 */
export class RuntimeTool {
    constructor() {
        runtimeToolInstance = this;
        this._externalURLHandler = null;
    }

    /**
     * 외부 링크 열기 요청에 대한 확인 핸들러를 등록합니다.
     * @param {(url: string) => (string|null|boolean|undefined)|null} handler - 외부 링크 확인 처리 함수입니다.
     */
    setExternalURLHandler(handler) {
        this._externalURLHandler = typeof handler === 'function' ? handler : null;
    }

    /**
     * URL을 외부 시스템 브라우저에서 엽니다.
     * @param {string} url - 열고자 하는 URL
     * @returns {string|boolean|null} 처리 결과입니다.
     */
    openURL(url) {
        const normalizedUrl = typeof url === 'string' ? url.trim() : '';
        if (!normalizedUrl) {
            return false;
        }

        if (typeof this._externalURLHandler === 'function') {
            const handledResult = this._externalURLHandler(normalizedUrl);
            if (handledResult !== null && handledResult !== undefined && handledResult !== false) {
                return handledResult;
            }
        }

        return this._openURLDirect(normalizedUrl);
    }

    /**
     * 확인 절차 없이 URL을 외부 시스템 브라우저에서 즉시 엽니다.
     * @param {string} url - 열고자 하는 URL
     * @returns {boolean} 브라우저 열기 시도 여부입니다.
     */
    _openURLDirect(url) {
        const normalizedUrl = typeof url === 'string' ? url.trim() : '';
        if (!normalizedUrl) {
            return false;
        }

        if (isNwRuntime()) {
            nw.Shell.openExternal(normalizedUrl);
            return true;
        }

        if (typeof window === 'undefined' || typeof window.open !== 'function') {
            return false;
        }

        const openedWindow = window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
        if (openedWindow) {
            openedWindow.opener = null;
        }
        return true;
    }

    /**
     * 창을 전체 화면으로 설정합니다.
     * @param {boolean} isFullScreen - 전체 화면 여부
     */
    setFullScreen(isFullScreen) {
        const appWindow = this._getWindow();
        if (appWindow) {
            if (isFullScreen) {
                appWindow.enterFullscreen();
            } else {
                appWindow.leaveFullscreen();
            }
            return true;
        }

        const documentElement = globalThis.document?.documentElement;
        const operation = isFullScreen
            ? documentElement?.requestFullscreen?.()
            : (globalThis.document?.fullscreenElement
                ? globalThis.document.exitFullscreen?.()
                : null);
        operation?.catch?.(() => {});
        return Boolean(operation);
    }

    /**
     * 창 크기를 설정합니다.
     * @param {number} width - 너비
     * @param {number} height - 높이
     */
    setWindowSize(width, height) {
        const appWindow = this._getWindow();
        if (!appWindow) {
            return false;
        }
        const nextWidth = Math.round(clampFiniteNumber(Number(width), 1, Infinity, appWindow.width || 1));
        const nextHeight = Math.round(clampFiniteNumber(Number(height), 1, Infinity, appWindow.height || 1));
        appWindow.resizeTo(nextWidth, nextHeight);
        return true;
    }

    /**
     * 창 위치를 설정합니다.
     * @param {number} x - x 좌표
     * @param {number} y - y 좌표
     */
    setWindowPosition(x, y) {
        const appWindow = this._getWindow();
        if (!appWindow) {
            return false;
        }
        const nextX = Math.round(resolveFiniteNumber(Number(x), appWindow.x || 0));
        const nextY = Math.round(resolveFiniteNumber(Number(y), appWindow.y || 0));
        appWindow.moveTo(nextX, nextY);
        return true;
    }

    /**
     * 창을 화면 중앙으로 이동합니다.
     */
    setWindowPositionCenter() {
        const appWindow = this._getWindow();
        if (!appWindow) {
            return false;
        }
        const width = clampFiniteNumber(Number(appWindow.width), 1, Infinity, 1);
        const height = clampFiniteNumber(Number(appWindow.height), 1, Infinity, 1);
        const screenWidth = clampFiniteNumber(Number(window.screen?.width), 1, Infinity, width);
        const screenHeight = clampFiniteNumber(Number(window.screen?.height), 1, Infinity, height);
        const x = Math.round((screenWidth - width) / 2);
        const y = Math.round((screenHeight - height) / 2);
        appWindow.moveTo(x, y);
        return true;
    }

    /**
     * 창을 닫습니다.
     */
    closeWindow() {
        const appWindow = this._getWindow();
        if (appWindow) {
            appWindow.close(true);
            return true;
        }

        globalThis.window?.close?.();
        return false;
    }

    /**
     * 줌 레벨을 설정합니다.
     * @param {number} zoomLevel - 줌 레벨
     */
    setZoomLevel(zoomLevel) {
        const appWindow = this._getWindow();
        if (!appWindow) {
            return false;
        }
        appWindow.zoomLevel = resolveFiniteNumber(Number(zoomLevel), appWindow.zoomLevel || 0);
        return true;
    }

    /**
     * 디버그 창을 엽니다.
     */
    openDebugWindow() {
        const appWindow = this._getWindow();
        if (!appWindow) {
            return false;
        }
        appWindow.showDevTools();
        return true;
    }

    /**
     * 현재 NW.js 앱 창 객체를 반환합니다.
     * @returns {NWJS_Helpers.win|null} NW.js 창 객체입니다.
     * @private
     */
    _getWindow() {
        return isNwRuntime() ? nw.Window.get() : null;
    }
}

/**
 * runtimeTool 싱글톤 인스턴스를 반환합니다.
 * @returns {RuntimeTool} RuntimeTool 인스턴스
 */
export function runtimeTool() {
    return runtimeToolInstance;
}

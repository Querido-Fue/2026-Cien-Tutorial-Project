import { getData } from 'data/data_handler.js';
import {
    beginWebGLLayerFrame,
    createWebGLLayerRenderer,
    destroyWebGLLayerRenderer,
    flushWebGLLayerRenderer,
    initializeWebGLLayerRendererSize,
    markOverlayLayerRendererDirty,
    resizeWebGLLayerRenderer
} from './_webgl_layer_renderer.js';
import {
    WorldPostProcessPipeline,
    WORLD_LAYER_IDS
} from './_world_postprocess_pipeline.js';
import { resolveWorldPostProcessQuality } from 'data/display/world_postprocess_constants.js';

const WEBGL_CONSTANTS = getData('WEBGL_CONSTANTS');
const DISPLAY_WEBGL_RENDER_MODES = getData('DISPLAY_SURFACE_DATA').WEBGL_RENDER_MODES;
const WORLD_POSTPROCESS_CONSTANTS = getData('WORLD_POSTPROCESS_CONSTANTS');
const WEBGL_BACKGROUND_LAYER_ID = 'background';
const WORLD_POSTPROCESS_LAYER_ID = WORLD_POSTPROCESS_CONSTANTS.LAYER_ID;
const WORLD_LAYER_ID_SET = new Set(WORLD_LAYER_IDS);

/**
 * @class WebGLHandler
 * @description 정적 WebGL 레이어와 동적 overlay effect surface를 함께 관리합니다.
 */
export class WebGLHandler {
    /**
     * @param {Object.<string, WebGLRenderingContext>} glContexts - 초기 WebGL 레이어 맵입니다.
     */
    constructor(glContexts = {}) {
        this.glContexts = new Map();
        this.layerModes = new Map();
        this.layerRenderers = new Map();
        this.width = 0;
        this.height = 0;
        this.backgroundColor = [...WEBGL_CONSTANTS.DEFAULT_BACKGROUND_COLOR];
        this.worldPostProcessPipeline = null;
        this.worldPostProcessActive = false;
        this.worldPostProcessFallbackReason = null;
        this.pendingWorldCommands = [];

        for (const [layerName, context] of Object.entries(glContexts)) {
            this.registerLayer(layerName, context, { mode: DISPLAY_WEBGL_RENDER_MODES.BATCH });
        }
    }

    /**
     * 레이어를 등록합니다.
     * @param {string} layerName - 레이어 식별자입니다.
     * @param {WebGLRenderingContext} gl - 연결할 WebGL 컨텍스트입니다.
     * @param {{mode?: 'batch'|'overlay-effect'|'effect'|'world-postprocess'}} [options] - 레이어 모드 옵션입니다.
     */
    registerLayer(layerName, gl, options = {}) {
        if (!layerName || !gl) {
            return;
        }

        const mode = options.mode || DISPLAY_WEBGL_RENDER_MODES.BATCH;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        this.glContexts.set(layerName, gl);
        this.layerModes.set(layerName, mode);

        if (mode === DISPLAY_WEBGL_RENDER_MODES.WORLD_POSTPROCESS) {
            this.#initializeWorldPostProcess(gl);
            return;
        }

        this.layerRenderers.set(layerName, createWebGLLayerRenderer(mode, gl));

        if (this.width > 0 && this.height > 0) {
            gl.viewport(0, 0, this.width, this.height);
            initializeWebGLLayerRendererSize(
                this.layerRenderers.get(layerName),
                this.width,
                this.height
            );
        }
    }

    /**
     * 레이어를 해제합니다.
     * @param {string} layerName - 해제할 레이어 식별자입니다.
     */
    unregisterLayer(layerName) {
        if (layerName === WORLD_POSTPROCESS_LAYER_ID) {
            this.worldPostProcessPipeline?.destroy();
            this.worldPostProcessPipeline = null;
            this.worldPostProcessActive = false;
        }
        destroyWebGLLayerRenderer(this.layerRenderers.get(layerName));
        this.glContexts.delete(layerName);
        this.layerModes.delete(layerName);
        this.layerRenderers.delete(layerName);
    }

    /**
     * 배경 색상을 갱신합니다.
     * @param {number} r - red 채널입니다.
     * @param {number} g - green 채널입니다.
     * @param {number} b - blue 채널입니다.
     */
    setBackgroundColor(r, g, b) {
        this.backgroundColor = [r, g, b, 1];
    }

    /**
     * 모든 WebGL 레이어를 프레임 시작 상태로 초기화합니다.
     */
    clearAll() {
        this.pendingWorldCommands.length = 0;
        if (this.worldPostProcessActive) {
            try {
                this.worldPostProcessPipeline.beginFrame(this.backgroundColor);
            } catch (error) {
                this.#fallbackToLegacy(error, false);
            }
        }

        for (const [layerName, gl] of this.glContexts.entries()) {
            if (layerName === WORLD_POSTPROCESS_LAYER_ID
                || (this.worldPostProcessActive && WORLD_LAYER_ID_SET.has(layerName))) {
                continue;
            }
            const mode = this.layerModes.get(layerName);
            const renderer = this.layerRenderers.get(layerName);

            if (layerName === WEBGL_BACKGROUND_LAYER_ID) {
                gl.clearColor(this.backgroundColor[0], this.backgroundColor[1], this.backgroundColor[2], this.backgroundColor[3]);
            } else {
                gl.clearColor(0, 0, 0, 0);
            }

            gl.clear(gl.COLOR_BUFFER_BIT);

            beginWebGLLayerFrame(renderer, mode, this.width, this.height);
        }
    }

    /**
     * 배치형 레이어를 flush합니다.
     */
    flushAll() {
        if (this.worldPostProcessActive) {
            try {
                this.worldPostProcessPipeline.flush();
                this.pendingWorldCommands.length = 0;
            } catch (error) {
                this.#fallbackToLegacy(error, true);
            }
        }

        for (const [layerName, renderer] of this.layerRenderers.entries()) {
            if (this.worldPostProcessActive && WORLD_LAYER_ID_SET.has(layerName)) {
                continue;
            }
            flushWebGLLayerRenderer(renderer);
        }
        this.pendingWorldCommands.length = 0;
    }

    /**
     * 화면 크기 변경을 각 레이어에 반영합니다.
     * @param {number} width - 새 너비입니다.
     * @param {number} height - 새 높이입니다.
     */
    resize(width, height) {
        this.width = width;
        this.height = height;

        for (const [layerName, gl] of this.glContexts.entries()) {
            gl.viewport(0, 0, width, height);
            resizeWebGLLayerRenderer(this.layerRenderers.get(layerName), width, height);
        }

        if (this.worldPostProcessActive) {
            try {
                this.worldPostProcessPipeline.resize(width, height);
            } catch (error) {
                this.#fallbackToLegacy(error, false);
            }
        }
    }

    /**
     * 특정 레이어에 렌더 명령을 전달합니다.
     * @param {string} layerName - 대상 레이어 식별자입니다.
     * @param {object} options - 렌더링 옵션입니다.
     */
    render(layerName, options) {
        if (this.worldPostProcessActive && WORLD_LAYER_ID_SET.has(layerName)) {
            this.pendingWorldCommands.push({ layerName, options });
            try {
                this.worldPostProcessPipeline.render(layerName, options);
            } catch (error) {
                this.#fallbackToLegacy(error, true);
            }
            return;
        }

        const renderer = this.layerRenderers.get(layerName);
        if (!renderer) {
            return;
        }

        renderer.render(options);
    }

    /**
     * blur 캐시를 무효화합니다.
     * @param {string} layerName - 대상 overlay effect 레이어입니다.
     */
    markDirty(layerName) {
        markOverlayLayerRendererDirty(this.layerRenderers.get(layerName));
    }

    /**
     * 렌더 스케일에 대응하는 후처리 품질 단계를 적용합니다.
     * @param {number} renderScale - 현재 렌더 스케일입니다.
     */
    setWorldPostProcessQualityForRenderScale(renderScale) {
        this.worldPostProcessPipeline?.setQuality(
            resolveWorldPostProcessQuality(renderScale)
        );
    }

    /**
     * 기존 테마 비네팅 값을 셰이더 합성 패스로 전달합니다.
     * @param {{rgb?: number[], alphaMultiplier?: number}} style - 비네팅 스타일입니다.
     */
    setWorldPostProcessVignetteStyle(style) {
        this.worldPostProcessPipeline?.setVignetteStyle(style);
    }

    /** @returns {boolean} 월드 후처리 활성 여부입니다. */
    isWorldPostProcessActive() {
        return this.worldPostProcessActive === true;
    }

    /** @returns {object} 후처리 진단 정보입니다. */
    getWorldPostProcessDiagnostics() {
        if (this.worldPostProcessActive && this.worldPostProcessPipeline) {
            return {
                ...this.worldPostProcessPipeline.getDiagnostics(),
                fallbackReason: null
            };
        }
        return {
            active: false,
            quality: null,
            bloomScale: WORLD_POSTPROCESS_CONSTANTS.BLOOM_SCALE,
            fallbackReason: this.worldPostProcessFallbackReason || 'unavailable'
        };
    }

    /** @private */
    #initializeWorldPostProcess(gl) {
        try {
            this.worldPostProcessPipeline = new WorldPostProcessPipeline(gl, {
                quality: WORLD_POSTPROCESS_CONSTANTS.DEFAULT_QUALITY,
                onFailure: (error) => this.#fallbackToLegacy(error, true)
            });
            this.worldPostProcessActive = true;
            this.worldPostProcessFallbackReason = null;
            this.#syncWorldLayerVisibility();
            if (this.width > 0 && this.height > 0) {
                this.worldPostProcessPipeline.resize(this.width, this.height);
            }
        } catch (error) {
            this.worldPostProcessPipeline = null;
            this.worldPostProcessActive = false;
            this.worldPostProcessFallbackReason = this.#formatFallbackReason(error);
            this.#syncWorldLayerVisibility();
            console.warn('[WebGLHandler] 월드 후처리를 초기화하지 못해 기존 렌더링을 사용합니다.', error);
        }
    }

    /** @private */
    #fallbackToLegacy(error, replayPendingCommands) {
        if (!this.worldPostProcessActive) {
            return;
        }
        this.worldPostProcessActive = false;
        this.worldPostProcessFallbackReason = this.#formatFallbackReason(error);
        this.#syncWorldLayerVisibility();

        if (replayPendingCommands && this.pendingWorldCommands.length > 0) {
            this.#prepareLegacyWorldFrame();
            for (const pending of this.pendingWorldCommands) {
                this.layerRenderers.get(pending.layerName)?.render(pending.options);
            }
            this.pendingWorldCommands.length = 0;
        }
        console.warn('[WebGLHandler] 월드 후처리 오류로 기존 렌더링에 복귀했습니다.', error);
    }

    /** @private */
    #prepareLegacyWorldFrame() {
        for (const layerName of WORLD_LAYER_IDS) {
            const gl = this.glContexts.get(layerName);
            const renderer = this.layerRenderers.get(layerName);
            const mode = this.layerModes.get(layerName);
            if (!gl || !renderer) {
                continue;
            }
            if (layerName === WEBGL_BACKGROUND_LAYER_ID) {
                gl.clearColor(...this.backgroundColor);
            } else {
                gl.clearColor(0, 0, 0, 0);
            }
            gl.clear(gl.COLOR_BUFFER_BIT);
            beginWebGLLayerFrame(renderer, mode, this.width, this.height);
        }
    }

    /** @private */
    #syncWorldLayerVisibility() {
        for (const layerName of WORLD_LAYER_IDS) {
            const canvas = this.glContexts.get(layerName)?.canvas;
            if (canvas?.style) {
                canvas.style.visibility = this.worldPostProcessActive ? 'hidden' : 'visible';
            }
        }
        const outputCanvas = this.glContexts.get(WORLD_POSTPROCESS_LAYER_ID)?.canvas;
        if (outputCanvas?.style) {
            outputCanvas.style.visibility = this.worldPostProcessActive ? 'visible' : 'hidden';
            outputCanvas.dataset.worldPostprocessStatus = this.worldPostProcessActive
                ? 'active'
                : 'fallback';
            if (this.worldPostProcessFallbackReason) {
                outputCanvas.dataset.worldPostprocessFallbackReason = this.worldPostProcessFallbackReason;
            } else {
                delete outputCanvas.dataset.worldPostprocessFallbackReason;
            }
        }
    }

    /** @private */
    #formatFallbackReason(error) {
        if (error instanceof Error && error.message) {
            return error.message;
        }
        return String(error || 'unknown WebGL error');
    }
}

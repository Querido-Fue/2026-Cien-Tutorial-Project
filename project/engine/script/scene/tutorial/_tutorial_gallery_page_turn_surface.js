/**
 * @class TutorialGalleryPageTurnSurface
 * @description 책·실제 내용을 두 오프스크린 캔버스에 래스터화하고 동적 WebGL surface를 관리합니다.
 */
export class TutorialGalleryPageTurnSurface {
    #displaySystem;
    #renderGL;
    #config;
    #document;
    #surfaceId;
    #surfaceCanvas;
    #snapshots;
    #snapshotKey;
    #textureLimit;
    #failed;
    #warned;
    #onContextLost;

    /**
     * @param {object} options - 디스플레이·렌더·문서 포트와 정적 설정입니다.
     */
    constructor({
        displaySystem = null,
        renderGL = () => {},
        config = {},
        documentRef = globalThis.document
    } = {}) {
        this.#displaySystem = displaySystem;
        this.#renderGL = renderGL;
        this.#config = config;
        this.#document = documentRef;
        this.#surfaceId = null;
        this.#surfaceCanvas = null;
        this.#snapshots = null;
        this.#snapshotKey = '';
        this.#textureLimit = Math.max(1, Number(config.MAX_TEXTURE_SIZE) || 4096);
        this.#failed = false;
        this.#warned = false;
        this.#onContextLost = (event) => {
            event?.preventDefault?.();
            this.#failed = true;
            this.clear();
        };
    }

    /**
     * draw 단계에서 완성한 이전·다음 책 내용을 GPU 명령에 전달합니다.
     * 같은 전환·해상도에서는 두 텍스처를 한 번만 래스터화합니다.
     * @param {object} command - 페이지 컬 WebGL 명령입니다.
     * @param {object} frames - viewport와 previous/next 렌더 콜백입니다.
     * @returns {boolean} 제출 여부입니다.
     */
    submit(command, frames = {}) {
        if (!this.#ensureSurface()) {
            return false;
        }
        const size = this.#resolveSize(frames.viewport);
        if (!size || typeof frames.previous !== 'function' || typeof frames.next !== 'function') {
            return false;
        }
        const key = [size.width, size.height, size.logicalWidth, size.logicalHeight].join('/');
        try {
            if (!this.#snapshots || key !== this.#snapshotKey) {
                this.#snapshots = {
                    previous: this.#rasterize('previous', size, frames.previous),
                    next: this.#rasterize('next', size, frames.next)
                };
                this.#snapshotKey = key;
            }
            this.#renderGL(this.#surfaceId, {
                ...command,
                image: this.#snapshots.previous,
                backImage: this.#snapshots.next
            });
            return true;
        } catch (error) {
            this.#failed = true;
            this.clear();
            this.#warnOnce(error);
            return false;
        }
    }

    /** 현재 전환의 래스터 참조를 해제합니다. */
    clear() {
        this.#snapshots = null;
        this.#snapshotKey = '';
    }

    /** 동적 WebGL surface와 이벤트 연결을 회수합니다. */
    destroy() {
        this.clear();
        this.#surfaceCanvas?.removeEventListener?.(
            'webglcontextlost',
            this.#onContextLost,
            false
        );
        if (this.#surfaceId) {
            this.#displaySystem?.releaseDynamicSurface?.(this.#surfaceId);
        }
        this.#surfaceId = null;
        this.#surfaceCanvas = null;
        this.#displaySystem = null;
    }

    /**
     * 엔진의 기존 2D 렌더러를 임시 오프스크린 레이어에 연결합니다.
     * 화면 UI의 현재 픽셀은 읽지 않으므로 frame.clear 순서에 영향받지 않습니다.
     * @param {string} name @param {object} size @param {Function} draw
     * @returns {HTMLCanvasElement} 책·글·그림이 모두 포함된 캔버스입니다. @private
     */
    #rasterize(name, size, draw) {
        const drawHandler = this.#displaySystem?.drawHandler;
        const source = this.#displaySystem?.getSurface?.('ui')?.canvas;
        const documentRef = source?.ownerDocument || this.#document;
        if (!documentRef?.createElement || !drawHandler?.registerLayer || !drawHandler?.render) {
            throw new Error('갤러리 페이지의 오프스크린 2D 렌더러가 없습니다.');
        }
        const canvas = documentRef.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext?.('2d', { alpha: true });
        if (!context) {
            throw new Error('갤러리 페이지의 2D 캔버스를 생성하지 못했습니다.');
        }
        const layer = `${this.#surfaceId}:page:${name}`;
        drawHandler.registerLayer(layer, context, {
            persistent: true,
            transformScaleX: size.width / size.logicalWidth,
            transformScaleY: size.height / size.logicalHeight
        });
        try {
            draw(Object.freeze({
                render: (_layer, options) => drawHandler.render(layer, options),
                measureText: (text, font) => drawHandler.measureText(text, font)
            }));
        } finally {
            drawHandler.unregisterLayer(layer);
        }
        return canvas;
    }

    /** @param {object} viewport @returns {object|null} GPU 한도 안의 네이티브 UI 크기입니다. @private */
    #resolveSize(viewport) {
        const logicalWidth = Number(viewport?.WW);
        const logicalHeight = Number(viewport?.WH);
        if (!(logicalWidth > 0) || !(logicalHeight > 0)) {
            return null;
        }
        const source = this.#displaySystem?.getSurface?.('ui')?.canvas;
        const nativeWidth = Number(source?.width) || logicalWidth;
        const nativeHeight = Number(source?.height) || logicalHeight;
        const scale = Math.min(
            nativeWidth / logicalWidth,
            nativeHeight / logicalHeight,
            this.#textureLimit / logicalWidth,
            this.#textureLimit / logicalHeight
        );
        return {
            logicalWidth,
            logicalHeight,
            width: Math.max(1, Math.floor(logicalWidth * scale)),
            height: Math.max(1, Math.floor(logicalHeight * scale))
        };
    }

    /** @returns {boolean} 전용 WebGL surface 준비 여부입니다. @private */
    #ensureSurface() {
        if (this.#failed) {
            return false;
        }
        if (this.#surfaceId) {
            return true;
        }
        try {
            const descriptor = this.#displaySystem?.createDynamicSurface?.({
                type: 'webgl',
                mode: 'effect',
                order: Number(this.#config.SURFACE_ORDER) || 90,
                includeInComposite: false
            });
            if (!descriptor?.id || !descriptor.context || !descriptor.canvas) {
                if (descriptor?.id) {
                    this.#displaySystem?.releaseDynamicSurface?.(descriptor.id);
                }
                this.#failed = true;
                return false;
            }
            const gl = descriptor.context;
            const gpuLimit = Number(gl.getParameter?.(gl.MAX_TEXTURE_SIZE));
            if (gpuLimit > 0) {
                this.#textureLimit = Math.min(this.#textureLimit, gpuLimit);
            }
            this.#surfaceId = descriptor.id;
            this.#surfaceCanvas = descriptor.canvas;
            this.#surfaceCanvas?.addEventListener?.(
                'webglcontextlost',
                this.#onContextLost,
                false
            );
            return true;
        } catch (error) {
            this.#failed = true;
            this.#warnOnce(error);
            return false;
        }
    }

    /** @param {*} error - 최초 한 번만 보고할 WebGL 폴백 원인입니다. @private */
    #warnOnce(error) {
        if (this.#warned) {
            return;
        }
        this.#warned = true;
        console.warn('[TutorialGallery] WebGL 페이지 전환을 사용할 수 없어 PNG 폴백을 사용합니다.', error);
    }
}

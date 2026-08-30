/**
 * @class TutorialGalleryPageTurnSurface
 * @description 갤러리 이전 프레임 캡처와 전용 동적 WebGL surface 수명만 소유합니다.
 */
export class TutorialGalleryPageTurnSurface {
    #displaySystem;
    #renderGL;
    #config;
    #document;
    #surfaceId;
    #surfaceCanvas;
    #snapshot;
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
        this.#snapshot = null;
        this.#failed = false;
        this.#warned = false;
        this.#onContextLost = (event) => {
            event?.preventDefault?.();
            this.#failed = true;
            this.#snapshot = null;
        };
    }

    /**
     * 지정 2D surface의 현재 픽셀을 페이지 텍스처로 복제합니다.
     * @param {string} sourceId - 캡처할 display surface ID입니다.
     * @returns {boolean} WebGL 전환 준비 여부입니다.
     */
    capture(sourceId = 'ui') {
        this.clear();
        if (!this.#ensureSurface()) {
            return false;
        }
        const source = this.#displaySystem?.getSurface?.(sourceId)?.canvas;
        const width = Number(source?.width);
        const height = Number(source?.height);
        const documentRef = source?.ownerDocument || this.#document;
        if (!(width > 0) || !(height > 0) || !documentRef?.createElement) {
            return false;
        }
        try {
            const snapshot = documentRef.createElement('canvas');
            snapshot.width = width;
            snapshot.height = height;
            const context = snapshot.getContext?.('2d', { alpha: true });
            if (!context) {
                return false;
            }
            context.clearRect(0, 0, width, height);
            context.drawImage(source, 0, 0, width, height);
            this.#snapshot = snapshot;
            return true;
        } catch (error) {
            this.#warnOnce(error);
            this.#snapshot = null;
            return false;
        }
    }

    /**
     * 캡처 텍스처를 포함한 pageTurn 명령을 전용 surface에 제출합니다.
     * @param {object} command - 페이지 컬 WebGL 명령입니다.
     * @returns {boolean} 제출 여부입니다.
     */
    submit(command) {
        if (this.#failed || !this.#surfaceId || !this.#snapshot) {
            return false;
        }
        try {
            this.#renderGL(this.#surfaceId, {
                ...command,
                image: this.#snapshot
            });
            return true;
        } catch (error) {
            this.#failed = true;
            this.#snapshot = null;
            this.#warnOnce(error);
            return false;
        }
    }

    /** 현재 프레임 캡처 참조를 해제합니다. */
    clear() {
        this.#snapshot = null;
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
            if (!descriptor?.id || !descriptor.context) {
                if (descriptor?.id) {
                    this.#displaySystem?.releaseDynamicSurface?.(descriptor.id);
                }
                this.#failed = true;
                return false;
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

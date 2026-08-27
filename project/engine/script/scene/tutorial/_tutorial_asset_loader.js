/** @returns {HTMLImageElement|null} 브라우저 이미지 객체입니다. */
function createBrowserImage() {
    return typeof Image === 'function' ? new Image() : null;
}

/** @returns {HTMLCanvasElement|null} 브라우저 canvas 객체입니다. */
function createBrowserCanvas() {
    return typeof document === 'undefined' ? null : document.createElement('canvas');
}

/** @param {*} value @returns {number} 유한 숫자 또는 0입니다. */
function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

/**
 * @class TutorialAssetLoader
 * @description 매니페스트 이미지의 로드, 크기 검증, 픽셀 크롭, 폴백과 캐시 수명을 소유합니다.
 */
export class TutorialAssetLoader {
    #imageFactory;
    #canvasFactory;
    #onChange;
    #entries;
    #manifestEntries;
    #destroyed;

    /** @param {object} options - 교체 가능한 Image/Canvas 팩토리와 변경 알림입니다. */
    constructor({
        imageFactory = createBrowserImage,
        canvasFactory = createBrowserCanvas,
        onChange = () => {}
    } = {}) {
        this.#imageFactory = imageFactory;
        this.#canvasFactory = canvasFactory;
        this.#onChange = onChange;
        this.#entries = new Map();
        this.#manifestEntries = new Map();
        this.#destroyed = false;
    }

    /**
     * 매니페스트의 모든 PNG를 런타임 경로에서 비동기 로드합니다.
     * @param {object} manifest - TUTORIAL_ASSET_MANIFEST 계약입니다.
     * @returns {readonly object[]} 로드 시작 상태입니다.
     */
    loadManifest(manifest) {
        const states = [];
        for (const manifestEntry of manifest?.ENTRIES || []) {
            if (!manifestEntry || typeof manifestEntry.id !== 'string') {
                continue;
            }
            this.#manifestEntries.set(manifestEntry.id, manifestEntry);
            if (manifestEntry.type !== 'image/png' || !manifestEntry.runtimePath) {
                const generated = {
                    image: null,
                    drawable: null,
                    source: null,
                    status: 'unavailable',
                    error: 'generated-fallback',
                    fallback: manifestEntry.fallback || null,
                    expectedDimensions: null,
                    actualDimensions: null,
                    sourceRect: null
                };
                this.#entries.set(manifestEntry.id, generated);
                states.push(this.#publicEntry(manifestEntry.id, generated));
                continue;
            }
            states.push(this.loadImage(
                manifestEntry.id,
                manifestEntry.runtimePath,
                {
                    expectedDimensions: manifestEntry.expectedDimensions,
                    sourceRect: manifestEntry.sourceRect,
                    fallback: manifestEntry.fallback
                }
            ));
        }
        this.#notify();
        return Object.freeze(states);
    }

    /**
     * 식별자와 경로로 이미지를 한 번 로드하고 캐시합니다.
     * @param {string} id - 캐시 식별자입니다.
     * @param {string} source - 런타임 이미지 경로입니다.
     * @param {object} [options={}] - 크기·크롭·폴백 계약입니다.
     * @returns {object} 현재 직렬화 가능한 상태입니다.
     */
    loadImage(id, source, options = {}) {
        return this.#load(id, source, options);
    }

    /**
     * 준비된 자체 이미지를 반환하고 실패했으면 선언된 fallback 체인을 따릅니다.
     * @param {string} id - 논리 에셋 ID입니다.
     * @returns {CanvasImageSource|null} 준비된 이미지입니다.
     */
    getImage(id) {
        const visited = new Set();
        let currentId = id;
        while (typeof currentId === 'string' && !visited.has(currentId)) {
            visited.add(currentId);
            const direct = this.getOwnImage(currentId);
            if (direct) {
                return direct;
            }
            const entry = this.#entries.get(currentId);
            currentId = entry?.fallback
                || this.#manifestEntries.get(currentId)?.fallback
                || null;
        }
        return null;
    }

    /** @param {string} id @returns {CanvasImageSource|null} 폴백을 적용하지 않은 이미지입니다. */
    getOwnImage(id) {
        const entry = this.#entries.get(id);
        return entry?.status === 'ready' && this.#isDrawableReady(entry.drawable)
            ? entry.drawable
            : null;
    }

    /** @param {string} id @returns {boolean} 폴백 포함 이미지 준비 여부입니다. */
    isReady(id) {
        return this.getImage(id) !== null;
    }

    /** @param {string} id @returns {boolean} 자체 이미지 준비 여부입니다. */
    isOwnReady(id) {
        return this.getOwnImage(id) !== null;
    }

    /** @param {string} id @returns {'missing'|'loading'|'ready'|'failed'|'unavailable'} 상태입니다. */
    getStatus(id) {
        return this.#entries.get(id)?.status || 'missing';
    }

    /** @returns {object} 파일별 상태와 실제 크기의 직렬화 가능한 스냅샷입니다. */
    getSnapshot() {
        return Object.freeze(Object.fromEntries(Array.from(this.#entries.entries()).map(
            ([id, entry]) => [id, Object.freeze({
                source: entry.source,
                status: entry.status,
                error: entry.error,
                fallback: entry.fallback,
                expectedDimensions: entry.expectedDimensions,
                actualDimensions: entry.actualDimensions,
                sourceRect: entry.sourceRect
            })]
        )));
    }

    /** 모든 이미지 콜백과 캐시를 제거합니다. */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        this.#destroyed = true;
        for (const entry of this.#entries.values()) {
            if (entry.image) {
                entry.image.onload = null;
                entry.image.onerror = null;
            }
        }
        this.#entries.clear();
        this.#manifestEntries.clear();
        this.#onChange = () => {};
    }

    /** @param {string} id @param {string} source @param {object} options @returns {object} @private */
    #load(id, source, options = {}) {
        if (this.#destroyed || typeof id !== 'string' || typeof source !== 'string') {
            return Object.freeze({ id, source, status: 'unavailable' });
        }
        const cached = this.#entries.get(id);
        if (cached && cached.source === source) {
            return this.#publicEntry(id, cached);
        }
        if (cached?.image) {
            cached.image.onload = null;
            cached.image.onerror = null;
        }
        let image = null;
        try {
            image = this.#imageFactory?.() || null;
        } catch (error) {
            image = null;
        }
        const entry = {
            image,
            drawable: null,
            source,
            status: image ? 'loading' : 'unavailable',
            error: image ? '' : 'image-factory-unavailable',
            fallback: typeof options.fallback === 'string' ? options.fallback : null,
            expectedDimensions: options.expectedDimensions || null,
            actualDimensions: null,
            sourceRect: options.sourceRect || null
        };
        this.#entries.set(id, entry);
        if (!image) {
            this.#notify();
            return this.#publicEntry(id, entry);
        }
        image.decoding = 'async';
        image.onload = () => this.#handleReady(id, entry);
        image.onerror = () => this.#handleFailure(id, entry, 'image-load-failed');
        try {
            image.src = source;
            if (this.#isImageReady(image)) {
                this.#handleReady(id, entry);
            } else {
                this.#notify();
            }
        } catch (error) {
            this.#handleFailure(id, entry, 'image-source-rejected');
        }
        return this.#publicEntry(id, entry);
    }

    /** @param {string} id @param {object} entry @private */
    #handleReady(id, entry) {
        if (this.#destroyed || this.#entries.get(id) !== entry || entry.status === 'ready') {
            return;
        }
        if (!this.#isImageReady(entry.image)) {
            this.#handleFailure(id, entry, 'image-empty');
            return;
        }
        entry.actualDimensions = Object.freeze({
            width: Number(entry.image.naturalWidth),
            height: Number(entry.image.naturalHeight)
        });
        if (entry.expectedDimensions
            && (Number(entry.expectedDimensions.width) !== entry.actualDimensions.width
                || Number(entry.expectedDimensions.height) !== entry.actualDimensions.height)) {
            this.#handleFailure(id, entry, 'image-dimensions-mismatch');
            return;
        }
        try {
            entry.drawable = entry.sourceRect
                ? this.#cropImage(entry.image, entry.sourceRect)
                : entry.image;
            if (!this.#isDrawableReady(entry.drawable)) {
                this.#handleFailure(id, entry, 'image-crop-failed');
                return;
            }
            entry.status = 'ready';
            entry.error = '';
        } catch (error) {
            this.#handleFailure(id, entry, 'image-crop-failed');
            return;
        }
        this.#notify();
    }

    /** @param {string} id @param {object} entry @param {string} reason @private */
    #handleFailure(id, entry, reason) {
        if (this.#destroyed || this.#entries.get(id) !== entry) {
            return;
        }
        entry.status = 'failed';
        entry.error = reason;
        entry.drawable = null;
        this.#notify();
    }

    /** @param {object} image @param {object} sourceRect @returns {HTMLCanvasElement|null} @private */
    #cropImage(image, sourceRect) {
        const x = Math.floor(toFiniteNumber(sourceRect.x));
        const y = Math.floor(toFiniteNumber(sourceRect.y));
        const width = Math.floor(toFiniteNumber(sourceRect.w));
        const height = Math.floor(toFiniteNumber(sourceRect.h));
        if (x < 0 || y < 0 || width <= 0 || height <= 0
            || x + width > Number(image.naturalWidth)
            || y + height > Number(image.naturalHeight)) {
            return null;
        }
        const canvas = this.#canvasFactory?.() || null;
        if (!canvas) {
            return null;
        }
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext?.('2d');
        if (!context) {
            return null;
        }
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, width, height);
        context.drawImage(image, x, y, width, height, 0, 0, width, height);
        return canvas;
    }

    /** @param {object|null} image @returns {boolean} @private */
    #isImageReady(image) {
        return Boolean(image?.complete
            && Number(image.naturalWidth) > 0
            && Number(image.naturalHeight) > 0);
    }

    /** @param {object|null} drawable @returns {boolean} @private */
    #isDrawableReady(drawable) {
        if (!drawable) {
            return false;
        }
        if ('complete' in drawable) {
            return this.#isImageReady(drawable);
        }
        return Number(drawable.width) > 0 && Number(drawable.height) > 0;
    }

    /** @param {string} id @param {object} entry @returns {object} @private */
    #publicEntry(id, entry) {
        return Object.freeze({
            id,
            source: entry.source,
            status: entry.status,
            error: entry.error
        });
    }

    /** @private */
    #notify() {
        if (!this.#destroyed) {
            this.#onChange(this.getSnapshot());
        }
    }
}

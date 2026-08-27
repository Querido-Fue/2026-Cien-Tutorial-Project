/** @returns {HTMLImageElement|null} 브라우저 이미지 객체입니다. */
function createBrowserImage() {
    return typeof Image === 'function' ? new Image() : null;
}

/** @returns {HTMLCanvasElement|null} 브라우저 canvas 객체입니다. */
function createBrowserCanvas() {
    return typeof document === 'undefined' ? null : document.createElement('canvas');
}

/**
 * @class TutorialAssetLoader
 * @description 튜토리얼 이미지 캐시, readiness, atlas 분할, 실패 폴백과 정리를 소유합니다.
 */
export class TutorialAssetLoader {
    #imageFactory;
    #canvasFactory;
    #onChange;
    #entries;
    #atlasCells;
    #destroyed;

    /**
     * @param {object} options - 테스트에서 교체 가능한 Image/Canvas 팩토리와 변경 알림입니다.
     */
    constructor({
        imageFactory = createBrowserImage,
        canvasFactory = createBrowserCanvas,
        onChange = () => {}
    } = {}) {
        this.#imageFactory = imageFactory;
        this.#canvasFactory = canvasFactory;
        this.#onChange = onChange;
        this.#entries = new Map();
        this.#atlasCells = new Map();
        this.#destroyed = false;
    }

    /**
     * 식별자와 경로로 이미지를 한 번 로드하고 캐시합니다.
     * @param {string} id - 캐시 식별자입니다.
     * @param {string} source - 런타임 이미지 경로입니다.
     * @returns {object} 현재 직렬화 가능한 상태입니다.
     */
    loadImage(id, source) {
        return this.#load(id, source, null);
    }

    /**
     * 이미지를 로드한 뒤 셀별 정사각형 canvas 캐시로 분할합니다.
     * @param {string} id - atlas 캐시 식별자입니다.
     * @param {string} source - 런타임 이미지 경로입니다.
     * @param {object} definition - COLUMNS, ROWS, CELLS 정의입니다.
     * @returns {object} 현재 직렬화 가능한 상태입니다.
     */
    loadAtlas(id, source, definition) {
        this.#atlasCells.set(id, new Map());
        return this.#load(id, source, (image) => {
            this.#sliceAtlas(id, image, definition || {});
        });
    }

    /** @param {string} id @returns {object|null} 준비된 이미지 또는 폴백 null입니다. */
    getImage(id) {
        const entry = this.#entries.get(id);
        return entry?.status === 'ready' && this.#isImageReady(entry.image)
            ? entry.image
            : null;
    }

    /** @param {string} atlasId @param {string} cellId @returns {object|null} 셀 canvas입니다. */
    getAtlasCell(atlasId, cellId) {
        return this.#atlasCells.get(atlasId)?.get(cellId) || null;
    }

    /** @param {string} atlasId @param {string} cellId @returns {boolean} 셀 준비 여부입니다. */
    hasAtlasCell(atlasId, cellId) {
        return this.#atlasCells.get(atlasId)?.has(cellId) === true;
    }

    /** @param {string} id @returns {boolean} 이미지 준비 여부입니다. */
    isReady(id) {
        return this.getImage(id) !== null;
    }

    /** @param {string} id @returns {'missing'|'loading'|'ready'|'failed'|'unavailable'} 상태입니다. */
    getStatus(id) {
        return this.#entries.get(id)?.status || 'missing';
    }

    /** @returns {object} 파일별 상태와 atlas 셀 수의 직렬화 가능한 스냅샷입니다. */
    getSnapshot() {
        return Object.freeze(Object.fromEntries(Array.from(this.#entries.entries()).map(
            ([id, entry]) => [id, Object.freeze({
                source: entry.source,
                status: entry.status,
                error: entry.error,
                atlasCellCount: this.#atlasCells.get(id)?.size || 0
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
        this.#atlasCells.clear();
        this.#onChange = () => {};
    }

    /** @param {string} id @param {string} source @param {Function|null} onReady @returns {object} @private */
    #load(id, source, onReady) {
        if (this.#destroyed || typeof id !== 'string' || typeof source !== 'string') {
            return Object.freeze({ id, source, status: 'unavailable' });
        }
        const cached = this.#entries.get(id);
        if (cached && cached.source === source) {
            if (onReady) {
                cached.onReady = onReady;
                if (cached.status === 'ready' && this.#isImageReady(cached.image)) {
                    try {
                        onReady(cached.image);
                    } catch (error) {
                        this.#handleFailure(id, cached, 'atlas-slice-failed');
                    }
                }
            }
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
            source,
            status: image ? 'loading' : 'unavailable',
            error: image ? '' : 'image-factory-unavailable',
            onReady
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
        entry.status = 'ready';
        entry.error = '';
        try {
            entry.onReady?.(entry.image);
        } catch (error) {
            this.#handleFailure(id, entry, 'atlas-slice-failed');
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
        this.#atlasCells.get(id)?.clear();
        this.#notify();
    }

    /** @param {string} id @param {object} image @param {object} definition @private */
    #sliceAtlas(id, image, definition) {
        const cells = this.#atlasCells.get(id) || new Map();
        cells.clear();
        this.#atlasCells.set(id, cells);
        const columns = Math.max(1, Number(definition.COLUMNS) || 1);
        const rows = Math.max(1, Number(definition.ROWS) || 1);
        const sourceWidth = image.naturalWidth / columns;
        const sourceHeight = image.naturalHeight / rows;
        const canvasSize = Math.max(1, Math.ceil(Math.max(sourceWidth, sourceHeight)));
        for (const [cellId, cell] of Object.entries(definition.CELLS || {})) {
            const column = Number(cell?.COLUMN);
            const row = Number(cell?.ROW);
            if (!Number.isInteger(column)
                || !Number.isInteger(row)
                || column < 0
                || row < 0
                || column >= columns
                || row >= rows) {
                continue;
            }
            let canvas = null;
            try {
                canvas = this.#canvasFactory?.() || null;
            } catch (error) {
                canvas = null;
            }
            if (!canvas) {
                continue;
            }
            canvas.width = canvasSize;
            canvas.height = canvasSize;
            const context = canvas.getContext?.('2d');
            if (!context) {
                continue;
            }
            context.clearRect(0, 0, canvasSize, canvasSize);
            context.imageSmoothingEnabled = true;
            context.drawImage(
                image,
                column * sourceWidth,
                row * sourceHeight,
                sourceWidth,
                sourceHeight,
                (canvasSize - sourceWidth) * 0.5,
                (canvasSize - sourceHeight) * 0.5,
                sourceWidth,
                sourceHeight
            );
            cells.set(cellId, canvas);
        }
    }

    /** @param {object|null} image @returns {boolean} @private */
    #isImageReady(image) {
        return Boolean(image?.complete
            && Number(image.naturalWidth) > 0
            && Number(image.naturalHeight) > 0);
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

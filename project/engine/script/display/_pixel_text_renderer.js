/** Canvas font 문자열의 px 크기 부분입니다. */
const FONT_SIZE_PATTERN = /(\d+(?:\.\d+)?)px/i;
/** 회전 각도를 라디안으로 바꾸는 배율입니다. */
const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Canvas font 문자열에서 px 단위 글꼴 크기를 읽습니다.
 * @param {string} font - Canvas font 문자열입니다.
 * @returns {number|null} 유효한 글꼴 크기 또는 null입니다.
 */
export function getCanvasFontSize(font) {
    const match = String(font || '').match(FONT_SIZE_PATTERN);
    const size = Number(match?.[1]);
    return Number.isFinite(size) && size > 0 ? size : null;
}

/**
 * Canvas font 문자열의 px 크기만 지정 배율로 바꿉니다.
 * @param {string} font - 원본 Canvas font 문자열입니다.
 * @param {number} scale - 적용할 배율입니다.
 * @returns {string|null} 변환된 font 문자열 또는 null입니다.
 */
export function scaleCanvasFontSize(font, scale) {
    const source = String(font || '');
    const size = getCanvasFontSize(source);
    if (!size || !Number.isFinite(scale) || scale <= 0) {
        return null;
    }

    const scaledSize = Number((size * scale).toFixed(3));
    return source.replace(FONT_SIZE_PATTERN, `${scaledSize}px`);
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function finiteMetric(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

/**
 * 실제 바운딩 메트릭이 없는 Canvas 구현에서 정렬별 가로 경계를 추정합니다.
 * @param {number} width - 측정 폭입니다.
 * @param {string} align - 텍스트 정렬입니다.
 * @returns {{left:number,right:number}} 앵커 기준 좌우 거리입니다.
 */
function estimateHorizontalBounds(width, align) {
    if (align === 'center') {
        return { left: width * 0.5, right: width * 0.5 };
    }
    if (align === 'right' || align === 'end') {
        return { left: width, right: 0 };
    }
    return { left: 0, right: width };
}

/**
 * @class PixelTextRenderer
 * @description 지정 폰트의 문자열을 작은 Canvas에 래스터화하고 최근접 확대해 그립니다.
 */
export class PixelTextRenderer {
    #profiles;
    #cache;
    #cacheLimit;
    #padding;
    #maxRasterWidth;
    #maxRasterHeight;
    #createCanvas;
    #measureContext;

    /**
     * @param {object} config - 텍스트 렌더 정책 데이터입니다.
     * @param {{createCanvas?:Function}} [options={}] - 테스트 가능한 Canvas 생성 포트입니다.
     */
    constructor(config = {}, options = {}) {
        this.#profiles = Array.isArray(config.PIXEL_PROFILES)
            ? config.PIXEL_PROFILES.filter((profile) => profile?.FONT_FAMILY)
            : [];
        this.#cache = new Map();
        this.#cacheLimit = Math.max(1, Math.floor(
            finiteMetric(config.PIXEL_CACHE_LIMIT, 256)
        ));
        this.#padding = Math.max(0, Math.ceil(finiteMetric(config.PIXEL_PADDING, 1)));
        this.#maxRasterWidth = Math.max(1, Math.floor(
            finiteMetric(config.MAX_RASTER_WIDTH, 4096)
        ));
        this.#maxRasterHeight = Math.max(1, Math.floor(
            finiteMetric(config.MAX_RASTER_HEIGHT, 512)
        ));
        this.#createCanvas = typeof options.createCanvas === 'function'
            ? options.createCanvas
            : () => globalThis.document?.createElement?.('canvas') || null;

        const measureCanvas = this.#createCanvas();
        this.#measureContext = measureCanvas?.getContext?.('2d') || null;
    }

    /**
     * 도트 렌더 대상 폰트라면 실제 저해상도 메트릭에 맞춘 폭을 반환합니다.
     * @param {string} text - 측정할 문자열입니다.
     * @param {string} font - Canvas font 문자열입니다.
     * @returns {number|null} 도트 렌더 폭 또는 비대상일 때 null입니다.
     */
    measureWidth(text, font) {
        const resolved = this.#resolveFont(font);
        if (!resolved || !this.#measureContext) {
            return null;
        }

        this.#measureContext.font = resolved.rasterFont;
        const width = Number(this.#measureContext.measureText(String(text ?? '')).width);
        return Number.isFinite(width) ? width * resolved.pixelSize : 0;
    }

    /**
     * 대상 폰트의 텍스트를 도트 래스터 이미지로 그립니다.
     * @param {CanvasRenderingContext2D} context - 최종 2D 레이어 컨텍스트입니다.
     * @param {object} options - 기존 text 렌더 명령입니다.
     * @returns {boolean} 도트 렌더 경로에서 처리했는지 여부입니다.
     */
    render(context, options) {
        const font = options?.font || context?.font;
        const resolved = this.#resolveFont(font);
        if (!context || !resolved) {
            return false;
        }

        const text = String(options?.text ?? '');
        if (!text) {
            return true;
        }

        const fill = typeof options?.fill === 'string'
            ? options.fill
            : (typeof context.fillStyle === 'string' ? context.fillStyle : null);
        if (!fill) {
            return false;
        }

        const align = options?.align || context.textAlign || 'start';
        const baseline = options?.baseline || context.textBaseline || 'alphabetic';
        const cacheKey = JSON.stringify([
            resolved.profile.ID,
            resolved.rasterFont,
            resolved.pixelSize,
            resolved.alphaThreshold,
            text,
            fill,
            align,
            baseline
        ]);
        const entry = this.#getCachedEntry(cacheKey)
            || this.#createRasterEntry({
                cacheKey,
                text,
                fill,
                align,
                baseline,
                ...resolved
            });
        if (!entry) {
            return false;
        }

        this.#drawEntry(context, options, entry, resolved.pixelSize);
        return true;
    }

    /** 래스터 캐시를 비웁니다. */
    clear() {
        this.#cache.clear();
    }

    /**
     * @param {string} font - Canvas font 문자열입니다.
     * @returns {object|null} 일치하는 폰트 프로필과 저해상도 font 정보입니다.
     * @private
     */
    #resolveFont(font) {
        const fontString = String(font || '');
        const normalizedFont = fontString.toLocaleLowerCase('en-US');
        const profile = this.#profiles.find(({ FONT_FAMILY: family }) => (
            normalizedFont.includes(String(family).toLocaleLowerCase('en-US'))
        ));
        const fontSize = getCanvasFontSize(fontString);
        if (!profile || !fontSize) {
            return null;
        }

        const useSmallGrid = Number.isFinite(Number(profile.SMALL_FONT_MAX_PX))
            && fontSize <= Number(profile.SMALL_FONT_MAX_PX);
        const requestedPixelSize = useSmallGrid
            ? profile.SMALL_PIXEL_SIZE
            : profile.PIXEL_SIZE;
        const pixelSize = Math.max(1, Math.round(finiteMetric(requestedPixelSize, 1)));
        const rasterFont = scaleCanvasFontSize(fontString, 1 / pixelSize);
        if (!rasterFont) {
            return null;
        }

        return {
            profile,
            pixelSize,
            rasterFont,
            rasterFontSize: fontSize / pixelSize,
            alphaThreshold: Math.max(0, Math.min(
                255,
                Math.round(finiteMetric(profile.ALPHA_THRESHOLD, 0))
            ))
        };
    }

    /**
     * @param {object} spec - 래스터 생성 사양입니다.
     * @returns {object|null} 캐시 가능한 래스터 엔트리입니다.
     * @private
     */
    #createRasterEntry(spec) {
        if (!this.#measureContext) {
            return null;
        }

        this.#measureContext.font = spec.rasterFont;
        this.#measureContext.textAlign = spec.align;
        this.#measureContext.textBaseline = spec.baseline;
        const metrics = this.#measureContext.measureText(spec.text);
        const width = Math.max(0, finiteMetric(metrics.width, 0));
        const estimatedHorizontal = estimateHorizontalBounds(width, spec.align);
        const left = Math.max(0, finiteMetric(
            metrics.actualBoundingBoxLeft,
            estimatedHorizontal.left
        ));
        const right = Math.max(0, finiteMetric(
            metrics.actualBoundingBoxRight,
            estimatedHorizontal.right
        ));
        const ascent = Math.max(0, finiteMetric(
            metrics.actualBoundingBoxAscent,
            spec.rasterFontSize * 0.82
        ));
        const descent = Math.max(0, finiteMetric(
            metrics.actualBoundingBoxDescent,
            spec.rasterFontSize * 0.28
        ));
        const canvasWidth = Math.max(1, Math.ceil(left + right + (this.#padding * 2)));
        const canvasHeight = Math.max(1, Math.ceil(
            ascent + descent + (this.#padding * 2)
        ));
        if (canvasWidth > this.#maxRasterWidth || canvasHeight > this.#maxRasterHeight) {
            return null;
        }

        const canvas = this.#createCanvas();
        if (!canvas) {
            return null;
        }
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const rasterContext = canvas.getContext?.('2d');
        if (!rasterContext) {
            return null;
        }

        const anchorX = this.#padding + left;
        const anchorY = this.#padding + ascent;
        rasterContext.font = spec.rasterFont;
        rasterContext.textAlign = spec.align;
        rasterContext.textBaseline = spec.baseline;
        rasterContext.fillStyle = spec.fill;
        rasterContext.fillText(spec.text, anchorX, anchorY);
        this.#thresholdAlpha(rasterContext, canvasWidth, canvasHeight, spec.alphaThreshold);

        const entry = { canvas, anchorX, anchorY };
        this.#cache.set(spec.cacheKey, entry);
        while (this.#cache.size > this.#cacheLimit) {
            this.#cache.delete(this.#cache.keys().next().value);
        }
        return entry;
    }

    /**
     * @param {string} cacheKey - 래스터 캐시 키입니다.
     * @returns {object|null} LRU 순서를 갱신한 캐시 엔트리입니다.
     * @private
     */
    #getCachedEntry(cacheKey) {
        const entry = this.#cache.get(cacheKey);
        if (!entry) {
            return null;
        }
        this.#cache.delete(cacheKey);
        this.#cache.set(cacheKey, entry);
        return entry;
    }

    /**
     * 글자 가장자리의 반투명 픽셀을 불투명/투명 도트로 양자화합니다.
     * @param {CanvasRenderingContext2D} context - 래스터 컨텍스트입니다.
     * @param {number} width - 래스터 폭입니다.
     * @param {number} height - 래스터 높이입니다.
     * @param {number} threshold - 알파 임계값입니다.
     * @private
     */
    #thresholdAlpha(context, width, height, threshold) {
        if (threshold <= 0 || typeof context.getImageData !== 'function'
            || typeof context.putImageData !== 'function') {
            return;
        }

        try {
            const imageData = context.getImageData(0, 0, width, height);
            for (let index = 3; index < imageData.data.length; index += 4) {
                imageData.data[index] = imageData.data[index] >= threshold ? 255 : 0;
            }
            context.putImageData(imageData, 0, 0);
        } catch {
            // Canvas 읽기가 제한된 환경에서는 저해상도 확대만 유지합니다.
        }
    }

    /**
     * @param {CanvasRenderingContext2D} context - 최종 컨텍스트입니다.
     * @param {object} options - text 렌더 명령입니다.
     * @param {object} entry - 래스터 캐시 엔트리입니다.
     * @param {number} pixelSize - 최근접 확대 배율입니다.
     * @private
     */
    #drawEntry(context, options, entry, pixelSize) {
        const width = entry.canvas.width * pixelSize;
        const height = entry.canvas.height * pixelSize;
        const x = finiteMetric(options.x, 0);
        const y = finiteMetric(options.y, 0);

        context.save();
        context.imageSmoothingEnabled = false;
        if (options.rotation) {
            context.translate(Math.round(x), Math.round(y));
            context.rotate(finiteMetric(options.rotation, 0) * DEGREES_TO_RADIANS);
            context.drawImage(
                entry.canvas,
                Math.round(-entry.anchorX * pixelSize),
                Math.round(-entry.anchorY * pixelSize),
                width,
                height
            );
        } else {
            context.drawImage(
                entry.canvas,
                Math.round(x - (entry.anchorX * pixelSize)),
                Math.round(y - (entry.anchorY * pixelSize)),
                width,
                height
            );
        }
        context.restore();
    }
}

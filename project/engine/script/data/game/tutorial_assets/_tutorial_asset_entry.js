/**
 * @param {{width:number,height:number}|null} dimensions - 이미지 크기입니다.
 * @returns {{width:number,height:number}|null} 정규화된 이미지 크기입니다.
 */
function normalizeDimensions(dimensions) {
    if (!dimensions) {
        return null;
    }
    return Object.freeze({
        width: Number(dimensions.width),
        height: Number(dimensions.height)
    });
}

/**
 * @param {{x:number,y:number,w:number,h:number}|null} sourceRect - 원본 내 유효 픽셀 영역입니다.
 * @returns {{x:number,y:number,w:number,h:number}|null} 정규화된 영역입니다.
 */
function normalizeSourceRect(sourceRect) {
    if (!sourceRect) {
        return null;
    }
    return Object.freeze({
        x: Number(sourceRect.x),
        y: Number(sourceRect.y),
        w: Number(sourceRect.w),
        h: Number(sourceRect.h)
    });
}

/**
 * PNG 에셋 매니페스트 항목의 공통 계약을 생성합니다.
 * @param {object} entry - 에셋별 선언입니다.
 * @returns {Readonly<object>} 읽기 전용 매니페스트 항목입니다.
 */
export function createTutorialPngAssetEntry(entry) {
    return Object.freeze({
        id: String(entry.id),
        runtimePath: String(entry.runtimePath),
        sourceName: String(entry.sourceName),
        type: 'image/png',
        expectedDimensions: normalizeDimensions(entry.expectedDimensions),
        actualDimensions: normalizeDimensions(entry.actualDimensions),
        layer: String(entry.layer),
        usage: String(entry.usage),
        required: entry.required !== false,
        fallback: typeof entry.fallback === 'string' ? entry.fallback : null,
        sourceRect: normalizeSourceRect(entry.sourceRect),
        pixelated: entry.pixelated !== false
    });
}

/**
 * 원본 이미지가 없는 코드 기반 폴백을 매니페스트에 명시합니다.
 * @param {object} entry - 폴백 선언입니다.
 * @returns {Readonly<object>} 읽기 전용 폴백 항목입니다.
 */
export function createTutorialGeneratedFallbackEntry(entry) {
    return Object.freeze({
        id: String(entry.id),
        runtimePath: null,
        sourceName: null,
        type: 'generated-fallback',
        expectedDimensions: null,
        actualDimensions: null,
        layer: String(entry.layer),
        usage: String(entry.usage),
        required: false,
        fallback: null,
        sourceRect: null,
        pixelated: true
    });
}

const LOGICAL_FRAME_SIZE = Object.freeze({ width: 32, height: 32 });
const DEFAULT_ANCHOR = Object.freeze({ x: 0.5, y: 0.88 });
const VISUAL_TOP_INSET_RATIO_BY_ACTOR = Object.freeze({
    player: 0.125,
    lora: 0.257,
    slime: 0.66
});

/** @param {*} value @returns {*} 객체와 배열을 재귀 동결합니다. */
function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
}

/**
 * 원본 프레임의 투명 상단 여백을 배우별 실측 비율로 정규화합니다.
 * @param {object} entry - 클립 선언입니다.
 * @returns {number} 프레임 높이 대비 실제 픽셀 상단 비율입니다.
 */
function resolveVisualTopInsetRatio(entry) {
    const explicit = Number(entry.visualTopInsetRatio);
    const fallback = VISUAL_TOP_INSET_RATIO_BY_ACTOR[String(entry.actorType)] || 0;
    const ratio = Number.isFinite(explicit) ? explicit : fallback;
    return Math.max(0, Math.min(0.95, ratio));
}

/**
 * 프레임별 좌·우 발 접점을 0~1 스프라이트 좌표로 정규화합니다.
 * @param {*} value - 프레임별 발 접점 목록입니다.
 * @returns {readonly (readonly {x:number,y:number}[])[]} 정규화된 발 접점입니다.
 */
function normalizeShadowFootFrames(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map((rawFrame) => (
        Array.isArray(rawFrame)
            ? rawFrame.slice(0, 2).map((rawPoint) => ({
                x: Math.max(0, Math.min(1, Number(rawPoint?.x) || 0)),
                y: Math.max(0, Math.min(1, Number(rawPoint?.y) || 0))
            }))
            : []
    ));
}

/**
 * 격자 셀 목록을 sourceRect 레이어로 변환합니다.
 * @param {object} options - 셀 크기와 프레임별 셀 좌표입니다.
 * @returns {readonly object[]} 동결된 프레임 목록입니다.
 */
export function createTutorialSpriteFrames({ cellWidth, cellHeight, frameCells }) {
    const width = Number(cellWidth);
    const height = Number(cellHeight);
    return deepFreeze((frameCells || []).map((rawCells) => {
        const cells = Array.isArray(rawCells) ? rawCells : [rawCells];
        return {
            layers: cells.filter(Boolean).map((cell) => ({
                x: Number(cell.column) * width,
                y: Number(cell.row) * height,
                w: width,
                h: height
            }))
        };
    }));
}

/**
 * 데이터 전용 스프라이트 클립 계약을 생성합니다.
 * @param {object} entry - 클립 선언입니다.
 * @returns {Readonly<object>} 정규화된 클립입니다.
 */
export function createTutorialSpriteClip(entry) {
    const frameEvents = Object.fromEntries(Object.entries(entry.frameEvents || {}).map(
        ([index, events]) => [String(index), [...events].map(String)]
    ));
    return deepFreeze({
        id: String(entry.id),
        actorType: String(entry.actorType),
        animationId: String(entry.animationId),
        facing: entry.facing ? String(entry.facing) : null,
        available: entry.available !== false,
        assetId: typeof entry.assetId === 'string' ? entry.assetId : null,
        assetIds: entry.assetIds ? { ...entry.assetIds } : null,
        frames: [...(entry.frames || [])],
        playbackFrameCount: Math.max(
            1,
            Math.floor(Number(entry.playbackFrameCount) || entry.frames?.length || 1)
        ),
        fps: Math.max(0.01, Number(entry.fps) || 1),
        loop: entry.loop === true,
        impactFrame: Number.isInteger(entry.impactFrame) ? entry.impactFrame : null,
        frameEvents,
        fallbackClipId: typeof entry.fallbackClipId === 'string'
            ? entry.fallbackClipId
            : null,
        fallbackEffect: typeof entry.fallbackEffect === 'string'
            ? entry.fallbackEffect
            : null,
        logicalSize: entry.logicalSize || LOGICAL_FRAME_SIZE,
        anchor: entry.anchor || DEFAULT_ANCHOR,
        scaleTileRatio: Math.max(0.1, Number(entry.scaleTileRatio) || 0.92),
        visualTopInsetRatio: resolveVisualTopInsetRatio(entry),
        shadowFootFrames: normalizeShadowFootFrames(entry.shadowFootFrames),
        terminal: entry.terminal === true,
        hideOnComplete: entry.hideOnComplete === true
    });
}

export const TUTORIAL_LOGICAL_SPRITE_FRAME_SIZE = LOGICAL_FRAME_SIZE;

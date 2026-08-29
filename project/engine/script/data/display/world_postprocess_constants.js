import { VIGNETTE_CONSTANTS } from './vignette_constants.js';

/**
 * 월드 후처리의 해상도, 색보정, Bloom 품질 단계 계약입니다.
 * UI surface는 이 파이프라인에 입력되지 않습니다.
 */
export const WORLD_POSTPROCESS_CONSTANTS = Object.freeze({
    LAYER_ID: 'world-postprocess',
    SOURCE_LAYER_IDS: Object.freeze(['background', 'object', 'effect']),
    BLOOM_SCALE: 0.25,
    DEFAULT_QUALITY: 'high',
    RENDER_SCALE_QUALITY_THRESHOLDS: Object.freeze({
        HIGH: 95,
        MEDIUM: 82
    }),
    VIGNETTE: Object.freeze({
        BASE_REFERENCE_HEIGHT_PX: VIGNETTE_CONSTANTS.BASE_REFERENCE_HEIGHT_PX,
        BASE_EDGE_WIDTH_PX: VIGNETTE_CONSTANTS.BASE_EDGE_WIDTH_PX,
        EDGE_WIDTH_MULTIPLIER: VIGNETTE_CONSTANTS.LAYERS.WORLD.EDGE_WIDTH_MULTIPLIER,
        BASE_CORNER_RADIUS_PX: VIGNETTE_CONSTANTS.BASE_CORNER_RADIUS_PX,
        BASE_ALPHA: VIGNETTE_CONSTANTS.BASE_EDGE_ALPHA,
        DEFAULT_COLOR: Object.freeze([0, 0, 0]),
        DEFAULT_ALPHA_MULTIPLIER: 0.4416
    }),
    QUALITY_TIERS: Object.freeze({
        low: Object.freeze({
            bloomPasses: 1,
            bloomThreshold: 0.76,
            bloomSoftKnee: 0.16,
            bloomIntensity: 0.13,
            contrast: 1.025,
            saturation: 1.025,
            shadowTint: 0.045,
            highlightTint: 0.035,
            grainStrength: 0.0032
        }),
        medium: Object.freeze({
            bloomPasses: 2,
            bloomThreshold: 0.72,
            bloomSoftKnee: 0.18,
            bloomIntensity: 0.17,
            contrast: 1.035,
            saturation: 1.04,
            shadowTint: 0.06,
            highlightTint: 0.05,
            grainStrength: 0.0042
        }),
        high: Object.freeze({
            bloomPasses: 3,
            bloomThreshold: 0.69,
            bloomSoftKnee: 0.2,
            bloomIntensity: 0.2,
            contrast: 1.045,
            saturation: 1.055,
            shadowTint: 0.075,
            highlightTint: 0.065,
            grainStrength: 0.0052
        })
    })
});

/**
 * 기존 렌더 스케일 단계에 대응하는 후처리 품질을 반환합니다.
 * @param {number} renderScale - 75~100 범위 렌더 스케일입니다.
 * @returns {'low'|'medium'|'high'} 품질 단계입니다.
 */
export function resolveWorldPostProcessQuality(renderScale) {
    const numericScale = Number(renderScale);
    if (numericScale >= WORLD_POSTPROCESS_CONSTANTS.RENDER_SCALE_QUALITY_THRESHOLDS.HIGH) {
        return 'high';
    }
    if (numericScale >= WORLD_POSTPROCESS_CONSTANTS.RENDER_SCALE_QUALITY_THRESHOLDS.MEDIUM) {
        return 'medium';
    }
    return 'low';
}

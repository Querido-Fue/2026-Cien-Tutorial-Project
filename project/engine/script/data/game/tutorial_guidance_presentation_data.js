/** @param {*} value @returns {*} 중첩 정적 데이터를 재귀적으로 동결합니다. */
function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
        return value;
    }
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
}

/**
 * 전투 튜토리얼의 단계 전환, 양피지 안전 영역, 아웃포커스 표현 규격입니다.
 */
export const TUTORIAL_GUIDANCE_PRESENTATION_DATA = deepFreeze({
    ANIMATION_SECONDS: 0.5,
    MAX_BLUR_PX: 8,
    MIN_BRIGHTNESS: 0.84,
    DIM_ALPHA: 0.07,
    FOCUS_PADDING_DESIGN_PX: 14,
    FOCUS_FEATHER_CSS_PX: 64,
    PAPER: {
        CONTENT_LEFT_RATIO: 0.2,
        CONTENT_RIGHT_RATIO: 0.2,
        CONTENT_TOP_RATIO: 0.22,
        CONTENT_BOTTOM_RATIO: 0.18,
        MESSAGE_FONT_SCALE: 0.68,
        FIRST_MESSAGE_FONT_SCALE: 0.76,
        MESSAGE_LINE_HEIGHT_RATIO: 1.24
    }
});

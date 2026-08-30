/**
 * 마우스 커서 렌더링 및 애니메이션 관련 상수 모음
 */
export const CURSOR_CONSTANTS = Object.freeze({
    NORMAL: Object.freeze({
        ARROW_ROTATION_DEG: 330,
        LARGE_ARROW_SIZE_WH_RATIO: 0.015,
        SMALL_ARROW_SIZE_WH_RATIO: 0.014,
        SUB_CIRCLE_RADIUS_WH_RATIO: 0,
        SUB_CIRCLE_ALPHA: 0,
        SUB_CIRCLE_OFFSET_X_WH_RATIO: 0.01,
        SUB_CIRCLE_OFFSET_Y_WH_RATIO: 0.02,
        CLICK_RADIUS_MULTIPLIER: 0.7,
        CLICK_ALPHA_MULTIPLIER: 1.5,
        ANIM_DURATION: 0.5
    }),
    ATTACK: Object.freeze({
        ICON_HEIGHT_WH_RATIO: 0.075,
        ICON_HEIGHT_MIN_PX: 46,
        ICON_HEIGHT_MAX_PX: 64,
        ICON_HOTSPOT_X_RATIO: 0.99,
        ICON_HOTSPOT_Y_RATIO: 0.015,
        INFO: Object.freeze({
            OFFSET_X_WH_RATIO: 0.035,
            OFFSET_X_MIN_PX: 24,
            OFFSET_X_MAX_PX: 34,
            OFFSET_Y_WH_RATIO: 0.009,
            OFFSET_Y_MIN_PX: 6,
            OFFSET_Y_MAX_PX: 10,
            PADDING_X_WH_RATIO: 0.014,
            PADDING_X_MIN_PX: 9,
            PADDING_X_MAX_PX: 13,
            PADDING_Y_WH_RATIO: 0.01,
            PADDING_Y_MIN_PX: 7,
            PADDING_Y_MAX_PX: 10,
            TITLE_LINE_HEIGHT_WH_RATIO: 0.026,
            TITLE_LINE_HEIGHT_MIN_PX: 18,
            TITLE_LINE_HEIGHT_MAX_PX: 24,
            DETAIL_LINE_HEIGHT_WH_RATIO: 0.024,
            DETAIL_LINE_HEIGHT_MIN_PX: 17,
            DETAIL_LINE_HEIGHT_MAX_PX: 22,
            LINE_GAP_WH_RATIO: 0.004,
            LINE_GAP_MIN_PX: 3,
            LINE_GAP_MAX_PX: 5,
            MIN_WIDTH_WH_RATIO: 0.17,
            MIN_WIDTH_MIN_PX: 112,
            MIN_WIDTH_MAX_PX: 156,
            VIEWPORT_MARGIN_WH_RATIO: 0.012,
            VIEWPORT_MARGIN_MIN_PX: 8,
            VIEWPORT_MARGIN_MAX_PX: 14,
            RADIUS_WH_RATIO: 0.008,
            RADIUS_MIN_PX: 5,
            RADIUS_MAX_PX: 8,
            BORDER_WIDTH_PX: 1
        })
    })
});

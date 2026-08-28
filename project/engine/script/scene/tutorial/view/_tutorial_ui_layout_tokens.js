/** @param {number} x @param {number} y @param {number} w @param {number} h */
function rect(x, y, w, h) {
    return Object.freeze({ x, y, w, h });
}

/**
 * Figma `<<최종 UI>>`의 평면 스크린샷에서 측정한 정규화 목표 영역입니다.
 * 내부 레이어가 없는 관찰값이므로 화면별 layout builder가 기능 상태에 맞게 세부 분할합니다.
 */
export const TUTORIAL_UI_LAYOUT_TOKENS = Object.freeze({
    MAIN: Object.freeze({
        LOGO: rect(0.385, 0.215, 0.27, 0.22),
        BUTTON_GROUP: rect(0.425, 0.55, 0.15, 0.18),
        BUTTON_GAP: 0.012
    }),
    STARTER: Object.freeze({
        MAP: rect(0.027, 0.025, 0.946, 0.95),
        TITLE: rect(0.435, 0.185, 0.13, 0.09),
        LEFT_CARD: rect(0.342, 0.38, 0.15, 0.37),
        RIGHT_CARD: rect(0.508, 0.38, 0.15, 0.37)
    }),
    PAUSE: Object.freeze({
        DIM: rect(0, 0, 1, 1),
        PANEL: rect(0.395, 0.355, 0.21, 0.29),
        BUTTON_GROUP: rect(0.435, 0.43, 0.13, 0.16)
    }),
    BATTLE: Object.freeze({
        MAP: rect(0.027, 0.025, 0.946, 0.95),
        TURN: rect(0.048, 0.06, 0.17, 0.045),
        LORA: rect(0.71, 0.06, 0.24, 0.15),
        PLAYER: rect(0.048, 0.815, 0.22, 0.12),
        ACTION: rect(0.82, 0.77, 0.13, 0.17),
        SECONDARY: rect(0.72, 0.69, 0.23, 0.075),
        CONTEXT: rect(0.045, 0.12, 0.16, 0.22),
        ITEM_FOCUS: rect(0.047, 0.58, 0.1, 0.23),
        ACHIEVEMENT: rect(0.39, 0.07, 0.155, 0.065)
    }),
    TUTORIAL: Object.freeze({
        CALLOUTS: Object.freeze([
            rect(0.045, 0.05, 0.16, 0.27),
            rect(0.17, 0.28, 0.13, 0.13),
            rect(0.52, 0.05, 0.15, 0.13),
            rect(0.70, 0.19, 0.16, 0.13),
            rect(0.84, 0.43, 0.13, 0.15),
            rect(0.13, 0.66, 0.15, 0.13),
            rect(0.71, 0.72, 0.17, 0.13)
        ]),
        SKIP: rect(0.435, 0.82, 0.13, 0.09)
    }),
    GALLERY: Object.freeze({
        BOOK: rect(0.235, 0.14, 0.53, 0.69),
        CLOSE: rect(0.90, 0.08, 0.035, 0.062),
        PREVIOUS: rect(0.465, 0.855, 0.03, 0.055),
        NEXT: rect(0.505, 0.855, 0.03, 0.055),
        LEFT_BOOKMARKS: Object.freeze([
            rect(0.17, 0.25, 0.10, 0.07),
            rect(0.17, 0.36, 0.10, 0.07)
        ]),
        RIGHT_BOOKMARKS: Object.freeze([
            rect(0.73, 0.28, 0.10, 0.07),
            rect(0.73, 0.39, 0.10, 0.07),
            rect(0.73, 0.50, 0.10, 0.07)
        ])
    }),
    RESULT: Object.freeze({
        BOOK: rect(0.19, 0.15, 0.58, 0.71),
        LEFT_PAGE: rect(0.21, 0.17, 0.27, 0.66),
        RIGHT_PAGE: rect(0.49, 0.17, 0.26, 0.66),
        BUTTON_GROUP: rect(0.54, 0.52, 0.15, 0.14)
    })
});


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
        LOGO: rect(0.365, 0.215, 0.27, 0.22),
        BUTTON_GROUP: rect(0.425, 0.55, 0.15, 0.18),
        VERSION_LABEL: rect(0.025, 0.905, 0.14, 0.03),
        CHANGELOG_BUTTON: rect(0.025, 0.94, 0.105, 0.042),
        BUTTON_GAP: 0.012,
        BUTTON_SCALE: 1.2
    }),
    STARTER: Object.freeze({
        MAP: rect(0.027, 0.025, 0.946, 0.95),
        TITLE: rect(0.435, 0.19, 0.13, 0.09),
        LEFT_CARD: rect(0.3433, 0.3967, 0.145, 0.3433),
        RIGHT_CARD: rect(0.5117, 0.3967, 0.145, 0.3433),
        CARD_TITLE_CENTER_Y: 0.11,
        CARD_ICON_BACKGROUND: rect(0.217, 0.184, 0.566, 0.451),
        CARD_DESCRIPTION: rect(0.11, 0.685, 0.78, 0.255),
        CARD_DESCRIPTION_FONT_SCALE: 0.72,
        CARD_DESCRIPTION_LINE_HEIGHT: 0.066,
        CARD_DESCRIPTION_MAX_LINES: 4
    }),
    PAUSE: Object.freeze({
        DIM: rect(0, 0, 1, 1),
        PANEL: rect(0.4015, 0.3653, 0.198, 0.267),
        BUTTON_GROUP: rect(0.44, 0.445, 0.12, 0.145)
    }),
    BATTLE: Object.freeze({
        MAP: rect(0.027, 0.025, 0.946, 0.95),
        TURN: rect(0.048, 0.06, 0.17, 0.045),
        LORA: rect(0.7085, 0.058, 0.2392, 0.1471),
        PLAYER: rect(0.047, 0.8129, 0.2247, 0.1275),
        ACTION: rect(0.82, 0.77, 0.13, 0.17),
        SECONDARY: rect(0.72, 0.69, 0.23, 0.075),
        ITEM_FOCUS: rect(0.045, 0.5949, 0.086, 0.2121),
        ACHIEVEMENT: rect(0.39, 0.07, 0.155, 0.065)
    }),
    TUTORIAL: Object.freeze({
        CALLOUTS: Object.freeze([
            rect(0.044, 0.051, 0.159, 0.27),
            rect(0.184, 0.283, 0.088, 0.142),
            rect(0.525, 0.044, 0.087, 0.149),
            rect(0.701, 0.192, 0.093, 0.145),
            rect(0.85, 0.435, 0.096, 0.146),
            rect(0.728, 0.779, 0.096, 0.145)
        ]),
        SKIP: rect(0.426, 0.813, 0.149, 0.097)
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
    CHANGELOG: Object.freeze({
        BOOK: rect(0.22, 0.11, 0.56, 0.76),
        CLOSE: rect(0.90, 0.08, 0.035, 0.062),
        PREVIOUS: rect(0.465, 0.885, 0.03, 0.055),
        NEXT: rect(0.505, 0.885, 0.03, 0.055),
        ENTRIES_PER_PAGE: 8
    }),
    RESULT: Object.freeze({
        BOOK: rect(0.19, 0.15, 0.58, 0.71),
        LEFT_PAGE: rect(0.21, 0.17, 0.27, 0.66),
        RIGHT_PAGE: rect(0.49, 0.17, 0.26, 0.66),
        BUTTON_GROUP: rect(0.54, 0.52, 0.15, 0.14)
    })
});

/** @param {number} x @param {number} y @returns {Readonly<object>} 정규화된 기준점입니다. */
function point(x, y) {
    return Object.freeze({ x, y });
}

/** @param {number} x @param {number} y @param {number} w @param {number} h @returns {Readonly<object>} 정규화된 영역입니다. */
function rect(x, y, w, h) {
    return Object.freeze({ x, y, w, h });
}

/**
 * 고정 컷씬 대화 버블의 배치와 타이핑 표현 규격입니다.
 * 버블 높이는 크롭된 676×96 픽셀 에셋 비율을 16:9 디자인 공간에서 보존합니다.
 */
export const TUTORIAL_DIALOGUE_PRESENTATION_DATA = Object.freeze({
    CHARACTER_INTERVAL_SECONDS: 0.02,
    BUBBLE_ASSET_KEY: 'dialogueBubble',
    MAX_TEXT_LINES: 2,
    TEXT_LINE_HEIGHT_WH: 3.8,
    LAYOUT: Object.freeze({
        TITLE: point(0.5, 0.105),
        PROGRESS: point(0.91, 0.105),
        BUBBLE: rect(0.08, 0.55, 0.84, 0.212),
        SKIP_BUTTON: rect(0.13, 0.84, 0.2, 0.075),
        NEXT_BUTTON: rect(0.67, 0.84, 0.2, 0.075)
    }),
    BUBBLE_CONTENT: Object.freeze({
        LEFT_RATIO: 0.055,
        RIGHT_RATIO: 0.055,
        SPEAKER_Y_RATIO: 0.3,
        TEXT_Y_RATIO: 0.64
    })
});

/**
 * 전투 중 기록 책의 진입·퇴장과 배경 감광 표현을 정의합니다.
 * @type {Readonly<object>}
 */
export const TUTORIAL_RECORD_PRESENTATION_DATA = Object.freeze({
    OPEN_SECONDS: 0.6,
    CLOSE_SECONDS: 0.4,
    OPEN_EASING: 'easeOutExpo',
    CLOSE_EASING: 'easeInExpo',
    MIN_SCALE: 0.72,
    CONTENT_REVEAL_START: 0.58,
    BACKDROP: Object.freeze({
        ELEMENT_ID: 'vignette',
        BLUR_PX: 10,
        BRIGHTNESS: 0.58,
        DIM_ALPHA: 0.28
    })
});

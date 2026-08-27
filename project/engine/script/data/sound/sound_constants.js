/**
 * 사운드 및 배경음악 설정 상수 모음
 */
export const SOUND_CONSTANTS = Object.freeze({
    VOLUME_MAX: 100,
    BGM: Object.freeze({
        DEFAULT_CUE_ID: 'bgm.main',
        DEFAULT_VOLUME: 100,
        AUTO_PLAY: false,
        CROSSFADE_SECONDS: 0.55,
        UNLOCK_EVENTS: Object.freeze(['pointerdown', 'keydown', 'touchstart'])
    }),
    SFX: Object.freeze({
        DEFAULT_VOLUME: 100
    }),
    UI: Object.freeze({
        DEFAULT_VOLUME: 100
    }),
    DIAGNOSTIC_SAMPLE: Object.freeze({
        CUE_ID: 'legacy.diagnostic.sample',
        DEFAULT_VOLUME: 80
    })
});

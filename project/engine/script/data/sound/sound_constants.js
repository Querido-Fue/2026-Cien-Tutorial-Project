/**
 * 사운드 및 배경음악 설정 상수 모음
 */
export const SOUND_CONSTANTS = Object.freeze({
    BGM: Object.freeze({
        PATH: '../asset/audio/기다려줘.mp3',
        DEFAULT_VOLUME: 100,
        AUTO_PLAY: false,
        UNLOCK_EVENTS: Object.freeze(['pointerdown', 'keydown', 'touchstart'])
    }),
    DIAGNOSTIC_SAMPLE: Object.freeze({
        PATH: '../asset/audio/기다려줘.mp3',
        DEFAULT_VOLUME: 80
    })
});

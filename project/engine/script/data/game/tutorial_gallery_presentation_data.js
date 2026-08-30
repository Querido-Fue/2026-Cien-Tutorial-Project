import { TUTORIAL_GAME_DATA } from './tutorial_game_data.js';

/**
 * 갤러리 책장 넘김의 시간·GPU 표면·종이 재질 표현을 정의합니다.
 * 기존 선택 전환 0.24초의 정확히 두 배를 갤러리 전용 시간으로 사용합니다.
 * @type {Readonly<object>}
 */
export const TUTORIAL_GALLERY_PRESENTATION_DATA = Object.freeze({
    PAGE_TURN_SECONDS: TUTORIAL_GAME_DATA.ANIMATION.SELECTION_SECONDS * 2,
    EASING: 'easeInOutCubic',
    CONTENT_SWAP_PROGRESS: 0.5,
    SURFACE_ORDER: 90,
    EFFECT_TYPE: 'pageTurn',
    CURL_STRENGTH: 0.5,
    DEPTH_RATIO: 0.56,
    PERSPECTIVE_RATIO: 3.15,
    SHADOW_ALPHA: 0.42,
    FALLBACK_FRAME_KEYS: Object.freeze([
        'endingBook1',
        'endingBook2',
        'endingBook3',
        'endingBook4',
        'endingBook1'
    ]),
    MATERIAL: Object.freeze({
        BACK_COLOR: '#e7b978',
        EDGE_COLOR: '#ffe0a8',
        SHADOW_COLOR: '#2b160a'
    })
});

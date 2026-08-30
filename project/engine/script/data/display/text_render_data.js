import {
    PRIMARY_GAME_FONT_FAMILY
} from '../ui/typography/font_family_constants.js';

/**
 * 런타임 폰트 로딩과 Canvas 텍스트 도트 래스터화 정책입니다.
 */
export const TEXT_RENDER_DATA = Object.freeze({
    FONT_LOAD_TIMEOUT_MS: 5000,
    FONT_FACES: Object.freeze([
        Object.freeze({
            FAMILY: PRIMARY_GAME_FONT_FAMILY,
            WEIGHT: 400,
            SIZE_PX: 24,
            SAMPLE: 'N번째 플레이어 가나다 0123456789'
        })
    ]),
    PIXEL_CACHE_LIMIT: 384,
    PIXEL_PADDING: 2,
    MAX_RASTER_WIDTH: 4096,
    MAX_RASTER_HEIGHT: 512,
    PIXEL_PROFILES: Object.freeze([
        Object.freeze({
            ID: 'ownglyph-park-dahyun-dot',
            FONT_FAMILY: PRIMARY_GAME_FONT_FAMILY,
            PIXEL_SIZE: 2,
            SMALL_FONT_MAX_PX: 22,
            SMALL_PIXEL_SIZE: 1,
            ALPHA_THRESHOLD: 182
        })
    ])
});

import {
    GAME_FONT_WEIGHTS,
    PRIMARY_GAME_FONT_FAMILY
} from '../ui/typography/font_family_constants.js';

/**
 * 런타임에서 미리 로드할 PF 스타더스트 폰트 굵기입니다.
 */
export const TEXT_RENDER_DATA = Object.freeze({
    FONT_LOAD_TIMEOUT_MS: 5000,
    FONT_FACES: Object.freeze([
        Object.freeze({
            FAMILY: PRIMARY_GAME_FONT_FAMILY,
            WEIGHT: GAME_FONT_WEIGHTS.BODY,
            SIZE_PX: 24,
            SAMPLE: 'N번째 플레이어 가나다 0123456789'
        }),
        Object.freeze({
            FAMILY: PRIMARY_GAME_FONT_FAMILY,
            WEIGHT: GAME_FONT_WEIGHTS.EMPHASIS,
            SIZE_PX: 24,
            SAMPLE: 'N번째 플레이어 가나다 0123456789'
        }),
        Object.freeze({
            FAMILY: PRIMARY_GAME_FONT_FAMILY,
            WEIGHT: GAME_FONT_WEIGHTS.DISPLAY,
            SIZE_PX: 24,
            SAMPLE: 'N번째 플레이어 가나다 0123456789'
        })
    ])
});

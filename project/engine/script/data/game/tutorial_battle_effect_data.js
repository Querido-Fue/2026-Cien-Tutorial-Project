import {
    TUTORIAL_EFFECT_ASSET_IDS
} from './tutorial_assets/_tutorial_effect_asset_entries.js';
import {
    TUTORIAL_SPRITE_ASSET_IDS
} from './tutorial_assets/_tutorial_sprite_asset_entries.js';

const EFFECT_IDS = Object.freeze({
    PLAYER_ARROW: 'player-arrow',
    PLAYER_ATTACK_DISTORTION: 'player-attack-distortion',
    LORA_AREA_EXPLOSION: 'lora-area-explosion'
});

/**
 * 화살 이동, 공격 공간 왜곡과 로라 전장 폭발의 프레임·시간·배치 계약입니다.
 */
export const TUTORIAL_BATTLE_EFFECT_DATA = Object.freeze({
    VERSION: 1,
    IDS: EFFECT_IDS,
    PLAYER_ATTACK_DISTORTION: Object.freeze({
        ID: EFFECT_IDS.PLAYER_ATTACK_DISTORTION,
        ENABLED: true,
        DURATION_SECONDS: 0.3,
        MIN_RADIUS_TILE_RATIO: 0.18,
        MAX_RADIUS_TILE_RATIO: 2.55,
        RING_WIDTH_TILE_RATIO: 0.48,
        STRENGTH_TILE_RATIO: 0.14,
        CENTER_Y_OFFSET_TILE_RATIO: -0.28,
        FADE_POWER: 1.35,
        MAX_ALPHA: 1,
        LAYER: 'effect'
    }),
    PLAYER_ARROW: Object.freeze({
        ID: EFFECT_IDS.PLAYER_ARROW,
        ASSET_ID: TUTORIAL_SPRITE_ASSET_IDS.playerRanged,
        SOURCE_RECTS: Object.freeze({
            left: Object.freeze({ x: 20, y: 156, w: 24, h: 7 }),
            right: Object.freeze({ x: 84, y: 156, w: 24, h: 7 })
        }),
        LAUNCH_FRAME: 4,
        SOURCE_FPS: 12,
        SPEED_TILES_PER_SECOND: 10,
        MIN_TRAVEL_SECONDS: 0.12,
        MAX_TRAVEL_SECONDS: 0.8,
        SIZE_TILE_RATIO: 0.72,
        ARC_HEIGHT_TILE_RATIO: 0.16,
        MAX_ALPHA: 1,
        LAYER: 'effect'
    }),
    LORA_AREA_EXPLOSION: Object.freeze({
        ID: EFFECT_IDS.LORA_AREA_EXPLOSION,
        ASSET_ID: TUTORIAL_EFFECT_ASSET_IDS.loraAreaExplosion,
        FRAME_WIDTH: 970,
        FRAME_HEIGHT: 580,
        FRAME_SEQUENCE: Object.freeze([0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12]),
        FRAME_ALPHAS: Object.freeze([
            0.78, 0.82, 0.86, 0.9, 0.92, 0.34,
            0.92, 0.92, 0.82, 0.66, 0.48, 0.25
        ]),
        FPS: 18,
        IMPACT_PLAYBACK_FRAME: 5,
        MAX_ALPHA: 0.92,
        ALIGNMENT: 'map-image-rect',
        LAYER: 'texteffect'
    })
});

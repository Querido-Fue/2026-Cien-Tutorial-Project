/**
 * 전투 층별 월드 조명과 부유 입자의 표현 튜닝값입니다.
 * 색상은 활성 테마의 `Tactics.Effects` 키로 해석합니다.
 */
export const TUTORIAL_BATTLE_LIGHTING_DATA = Object.freeze({
    PROFILES: Object.freeze({
        'first-floor': Object.freeze({
            EXPOSURE: 0.78,
            AMBIENT_COLOR_KEY: 'UpperAmbient',
            CANDLE: Object.freeze({
                LIGHT_COLOR_KEY: 'CandleLight',
                LIGHTS_PER_FIXTURE: 2,
                RADIUS_SIZE_RATIO: 15,
                INTENSITY: 0.16,
                FLICKER_AMOUNT: 0.025,
                BREATH_AMOUNT: 0.055,
                BREATH_SPEED: 1.45,
                MIRROR_OPPOSITE_WALLS: true,
                MIRRORED_INTENSITY_SCALE: 0.42
            }),
            PARTICLES: Object.freeze({
                MIN_COUNT: 16,
                MAX_COUNT: 30,
                AREA_DIVISOR: 48000,
                ALPHA: 0.18,
                WARM_COLOR_KEY: 'FlameEmber',
                COOL_COLOR_KEY: 'Debris'
            })
        }),
        basement: Object.freeze({
            EXPOSURE: 0.6,
            AMBIENT_COLOR_KEY: 'BasementAmbient',
            CANDLE: null,
            PARTICLES: Object.freeze({
                MIN_COUNT: 30,
                MAX_COUNT: 48,
                AREA_DIVISOR: 34000,
                ALPHA: 0.62,
                WARM_COLOR_KEY: 'BasementMoteWarm',
                COOL_COLOR_KEY: 'BasementMoteCool'
            })
        })
    })
});

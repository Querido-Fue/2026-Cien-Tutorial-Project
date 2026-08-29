/**
 * WebGL effect 레이어 렌더 명령과 pass registry가 공유하는 상수입니다.
 */
export const EFFECT_RENDER_CONSTANTS = Object.freeze({
    TYPES: Object.freeze({
        MAGNETIC_SHIELD: 'magneticShield',
        FLAME_PARTICLES: 'flameParticles'
    }),
    FLAME: Object.freeze({
        MAX_EMITTERS_PER_COMMAND: 32,
        MIN_SIZE: 1,
        MAX_SIZE: 64,
        BOUNDS_X_SIZE_RATIO: 3.2,
        BOUNDS_TOP_SIZE_RATIO: 4.2,
        BOUNDS_BOTTOM_SIZE_RATIO: 1.8
    })
});

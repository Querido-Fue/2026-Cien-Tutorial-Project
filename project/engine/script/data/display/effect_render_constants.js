/**
 * WebGL effect 레이어 렌더 명령과 pass registry가 공유하는 상수입니다.
 */
export const EFFECT_RENDER_CONSTANTS = Object.freeze({
    TYPES: Object.freeze({
        MAGNETIC_SHIELD: 'magneticShield',
        FLAME_PARTICLES: 'flameParticles',
        AMBIENT_DUST: 'ambientDust',
        SCENE_LIGHTING: 'sceneLighting',
        SPATIAL_DISTORTION: 'spatialDistortion'
    }),
    FLAME: Object.freeze({
        MAX_EMITTERS_PER_COMMAND: 32,
        MIN_SIZE: 1,
        MAX_SIZE: 64,
        PIXEL_GRID_SIZE: 2,
        BOUNDS_X_SIZE_RATIO: 3.2,
        BOUNDS_TOP_SIZE_RATIO: 4.2,
        BOUNDS_BOTTOM_SIZE_RATIO: 1.8
    }),
    MAGNETIC_SHIELD: Object.freeze({
        PIXEL_GRID_SIZE: 2
    }),
    AMBIENT_DUST: Object.freeze({
        MAX_PARTICLES_PER_COMMAND: 56,
        DEFAULT_PARTICLE_COUNT: 38,
        PIXEL_GRID_SIZE: 2,
        MIN_POINT_SIZE: 1,
        MAX_POINT_SIZE: 2
    }),
    SCENE_LIGHTING: Object.freeze({
        MAX_EMITTERS_PER_COMMAND: 32,
        MIN_EXPOSURE: 0.35,
        MIN_RADIUS: 8,
        MAX_RADIUS: 360
    }),
    SPATIAL_DISTORTION: Object.freeze({
        MAX_COMMANDS_PER_FRAME: 4,
        MIN_RADIUS: 1,
        MAX_RADIUS: 640,
        MIN_RING_WIDTH: 1,
        MAX_RING_WIDTH: 180,
        MAX_STRENGTH: 48
    })
});

import { TUTORIAL_SPRITE_ASSET_IDS as ASSETS } from '../tutorial_assets/_tutorial_sprite_asset_entries.js';
import {
    createTutorialSpriteClip,
    createTutorialSpriteFrames
} from './_tutorial_sprite_clip_entry.js';

const DIRECTION_SOURCES = Object.freeze({
    right: Object.freeze({ row: 0, flipX: false, footFacing: 'right' }),
    left: Object.freeze({ row: 0, flipX: true, footFacing: 'right' }),
    up: Object.freeze({ row: 2, flipX: false, footFacing: 'up' }),
    down: Object.freeze({ row: 3, flipX: false, footFacing: 'down' })
});
const SHADOW_FOOT_PIXELS = Object.freeze({
    right: [[35, 60], [40, 61]],
    up: [[35, 61], [40, 60]],
    down: [[33, 60], [38, 61]]
});
const clips = [];

/** @param {string} facing @returns {readonly object[]} 실측한 로라 양발 접점 한 프레임입니다. */
function createLoraShadowFootFrame(facing) {
    return [SHADOW_FOOT_PIXELS[facing].map(([x, y]) => ({
        x: (x + 0.5) / 74,
        y: (y + 1) / 74
    }))];
}

for (const [facing, source] of Object.entries(DIRECTION_SOURCES)) {
    const idleFrames = createTutorialSpriteFrames({
        cellWidth: 74,
        cellHeight: 74,
        frameCells: [{ column: 0, row: source.row }]
    });
    clips.push(createTutorialSpriteClip({
        id: `lora.idle.${facing}`,
        actorType: 'lora',
        animationId: 'idle',
        facing,
        flipX: source.flipX,
        assetId: ASSETS.loraWalk,
        frames: idleFrames,
        fps: 1,
        loop: true,
        shadowFootFrames: createLoraShadowFootFrame(source.footFacing),
        scaleTileRatio: 0.94
    }));

    const missing = [
        ['melee', 4, 8, 2, false, 'attack'],
        ['area', 6, 10, 3, false, 'area'],
        ['hit', 4, 12, null, false, 'hit'],
        ['unstable', 4, 2, null, true, 'breathing'],
        ['collapse', 4, 2, null, true, 'breathing'],
        ['death', 4, 8, null, false, 'death']
    ];
    for (const [animationId, count, fps, impactFrame, loop, effect] of missing) {
        clips.push(createTutorialSpriteClip({
            id: `lora.${animationId}.${facing}`,
            actorType: 'lora',
            animationId,
            facing,
            flipX: source.flipX,
            available: false,
            playbackFrameCount: count,
            fps,
            loop,
            impactFrame,
            fallbackClipId: `lora.idle.${facing}`,
            fallbackEffect: effect,
            terminal: animationId === 'death',
            scaleTileRatio: 0.94
        }));
    }
}

export const TUTORIAL_LORA_SPRITE_CLIPS = Object.freeze(clips);

import { TUTORIAL_SPRITE_ASSET_IDS as ASSETS } from '../tutorial_assets/_tutorial_sprite_asset_entries.js';
import {
    createTutorialSpriteClip,
    createTutorialSpriteFrames
} from './_tutorial_sprite_clip_entry.js';

const DIRECTIONS = Object.freeze({ right: 0, left: 1, up: 2, down: 3 });
const SHADOW_FOOT_PIXELS = Object.freeze({
    right: [[35, 60], [40, 61]],
    left: [[34, 61], [39, 60]],
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

for (const [facing, row] of Object.entries(DIRECTIONS)) {
    const idleFrames = createTutorialSpriteFrames({
        cellWidth: 74,
        cellHeight: 74,
        frameCells: [{ column: 0, row }]
    });
    clips.push(createTutorialSpriteClip({
        id: `lora.idle.${facing}`,
        actorType: 'lora',
        animationId: 'idle',
        facing,
        assetId: ASSETS.loraWalk,
        frames: idleFrames,
        fps: 1,
        loop: true,
        shadowFootFrames: createLoraShadowFootFrame(facing),
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

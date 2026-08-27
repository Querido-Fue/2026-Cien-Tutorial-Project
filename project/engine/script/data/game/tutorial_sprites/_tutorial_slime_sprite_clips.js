import { TUTORIAL_SPRITE_ASSET_IDS as ASSETS } from '../tutorial_assets/_tutorial_sprite_asset_entries.js';
import {
    createTutorialSpriteClip,
    createTutorialSpriteFrames
} from './_tutorial_sprite_clip_entry.js';

const ASSET_VARIANTS = Object.freeze({
    blue: ASSETS.slimeBlue,
    green: ASSETS.slimeGreen
});

/** @param {number} row @param {number[]} columns @returns {readonly object[]} 슬라임 프레임입니다. */
function rowFrames(row, columns) {
    return createTutorialSpriteFrames({
        cellWidth: 64,
        cellHeight: 64,
        frameCells: columns.map((column) => ({ column, row }))
    });
}

export const TUTORIAL_SLIME_SPRITE_CLIPS = Object.freeze([
    createTutorialSpriteClip({
        id: 'slime.idle',
        actorType: 'slime',
        animationId: 'idle',
        assetIds: ASSET_VARIANTS,
        frames: rowFrames(0, [0, 1, 2, 3, 2, 1]),
        fps: 6,
        loop: true,
        scaleTileRatio: 0.72
    }),
    createTutorialSpriteClip({
        id: 'slime.attack',
        actorType: 'slime',
        animationId: 'attack',
        assetIds: ASSET_VARIANTS,
        frames: rowFrames(2, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
        fps: 12,
        impactFrame: 4,
        scaleTileRatio: 0.72
    }),
    createTutorialSpriteClip({
        id: 'slime.hit',
        actorType: 'slime',
        animationId: 'hit',
        assetIds: ASSET_VARIANTS,
        frames: rowFrames(3, [0, 1, 2, 3]),
        fps: 12,
        scaleTileRatio: 0.72
    }),
    createTutorialSpriteClip({
        id: 'slime.death',
        actorType: 'slime',
        animationId: 'death',
        assetIds: ASSET_VARIANTS,
        frames: rowFrames(1, [0, 1, 2, 3]),
        fps: 8,
        terminal: true,
        hideOnComplete: true,
        scaleTileRatio: 0.72
    })
]);

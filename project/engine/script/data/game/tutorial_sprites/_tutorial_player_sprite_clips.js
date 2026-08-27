import { TUTORIAL_SPRITE_ASSET_IDS as ASSETS } from '../tutorial_assets/_tutorial_sprite_asset_entries.js';
import {
    createTutorialSpriteClip,
    createTutorialSpriteFrames
} from './_tutorial_sprite_clip_entry.js';

const DIRECTIONS = Object.freeze({ left: 0, right: 1, up: 2, down: 3 });
const HORIZONTAL_DIRECTIONS = Object.freeze({ left: 0, right: 1 });

/** @param {number} row @param {number[]} columns @returns {readonly object[]} 단일 레이어 프레임입니다. */
function rowFrames(row, columns) {
    return createTutorialSpriteFrames({
        cellWidth: 64,
        cellHeight: 64,
        frameCells: columns.map((column) => ({ column, row }))
    });
}

/** @param {number} actorRow @returns {readonly object[]} 배우와 검격을 합성한 프레임입니다. */
function meleeFrames(actorRow) {
    const effectRow = actorRow + 1;
    return createTutorialSpriteFrames({
        cellWidth: 64,
        cellHeight: 64,
        frameCells: [0, 1, 2, 3].map((column) => [
            { column, row: actorRow },
            { column, row: effectRow }
        ])
    });
}

const clips = [];
for (const [facing, row] of Object.entries(DIRECTIONS)) {
    clips.push(createTutorialSpriteClip({
        id: `player.idle.${facing}`,
        actorType: 'player',
        animationId: 'idle',
        facing,
        assetId: ASSETS.playerWalk,
        frames: rowFrames(row, [0]),
        fps: 1,
        loop: true
    }));
    clips.push(createTutorialSpriteClip({
        id: `player.walk.${facing}`,
        actorType: 'player',
        animationId: 'walk',
        facing,
        assetId: ASSETS.playerWalk,
        frames: rowFrames(row, [0, 1, 2, 3]),
        fps: 8,
        loop: true,
        frameEvents: { 1: ['footstep'], 3: ['footstep'] }
    }));
}

for (const [facing, row] of Object.entries(HORIZONTAL_DIRECTIONS)) {
    clips.push(createTutorialSpriteClip({
        id: `player.melee.${facing}`,
        actorType: 'player',
        animationId: 'melee',
        facing,
        assetId: ASSETS.playerMelee,
        frames: meleeFrames(row * 2),
        fps: 10,
        impactFrame: 2
    }));
    clips.push(createTutorialSpriteClip({
        id: `player.hit.${facing}`,
        actorType: 'player',
        animationId: 'hit',
        facing,
        assetId: ASSETS.playerHit,
        frames: rowFrames(row, [0, 1, 2, 3]),
        fps: 12
    }));
    clips.push(createTutorialSpriteClip({
        id: `player.heal.${facing}`,
        actorType: 'player',
        animationId: 'heal',
        facing,
        assetId: ASSETS.playerHeal,
        frames: rowFrames(row, Array.from({ length: 19 }, (_, index) => index)),
        fps: 18,
        impactFrame: 8
    }));
    clips.push(createTutorialSpriteClip({
        id: `player.item.${facing}`,
        actorType: 'player',
        animationId: 'item',
        facing,
        assetId: ASSETS.playerItem,
        frames: rowFrames(row, [0, 1, 2, 3, 4]),
        fps: 10,
        impactFrame: 3
    }));
    clips.push(createTutorialSpriteClip({
        id: `player.ranged.${facing}`,
        actorType: 'player',
        animationId: 'ranged',
        facing,
        available: false,
        playbackFrameCount: 5,
        fps: 10,
        impactFrame: 3,
        fallbackClipId: `player.item.${facing}`,
        fallbackEffect: 'ranged'
    }));
    clips.push(createTutorialSpriteClip({
        id: `player.death.${facing}`,
        actorType: 'player',
        animationId: 'death',
        facing,
        available: false,
        playbackFrameCount: 4,
        fps: 8,
        fallbackClipId: `player.hit.${facing}`,
        fallbackEffect: 'death',
        terminal: true
    }));
}

for (const facing of ['up', 'down']) {
    const horizontal = facing === 'up' ? 'left' : 'right';
    for (const animationId of ['melee', 'hit', 'heal', 'item', 'ranged', 'death']) {
        const source = clips.find((clip) => clip.id === `player.${animationId}.${horizontal}`);
        clips.push(createTutorialSpriteClip({
            id: `player.${animationId}.${facing}`,
            actorType: 'player',
            animationId,
            facing,
            available: false,
            playbackFrameCount: source?.playbackFrameCount || 4,
            fps: source?.fps || 10,
            impactFrame: source?.impactFrame,
            fallbackClipId: `player.${animationId}.${horizontal}`,
            fallbackEffect: animationId === 'ranged' ? 'ranged' : 'directional',
            terminal: animationId === 'death'
        }));
    }
}

export const TUTORIAL_PLAYER_SPRITE_CLIPS = Object.freeze(clips);

import { TUTORIAL_SPRITE_ASSET_IDS as ASSETS } from '../tutorial_assets/_tutorial_sprite_asset_entries.js';
import {
    createTutorialSpriteClip,
    createTutorialSpriteFrames
} from './_tutorial_sprite_clip_entry.js';

const DIRECTIONS = Object.freeze({ left: 0, right: 1, up: 2, down: 3 });
const HORIZONTAL_DIRECTIONS = Object.freeze({ left: 0, right: 1 });
const BREATHING_HEAD_OFFSETS = Object.freeze([0, -1 / 64, -1 / 64, 0]);
const WALK_SHADOW_FOOT_PIXELS = Object.freeze({
    left: [
        [[28.5, 54], [33.5, 56]],
        [[25, 55], [36, 56]],
        [[28.5, 54], [33.5, 56]],
        [[28.5, 56], [36.5, 55]]
    ],
    right: [
        [[29.5, 56], [34.5, 54]],
        [[27, 56], [38, 55]],
        [[29.5, 56], [34.5, 54]],
        [[26.5, 55], [34.5, 56]]
    ],
    up: [
        [[30.5, 56], [35, 55]],
        [[30, 55], [38.5, 54]],
        [[30.5, 56], [35, 55]],
        [[32, 56], [34, 56]]
    ],
    down: [
        [[28, 55], [32.5, 56]],
        [[24.5, 54], [33, 55]],
        [[28, 55], [32.5, 56]],
        [[29.5, 56], [32, 55]]
    ]
});
const MELEE_SHADOW_FOOT_PIXELS = Object.freeze({
    left: [
        [[29, 54], [37.5, 55]],
        [[29, 51], [39, 52]],
        [[29, 51], [39, 52]],
        [[29, 51], [39, 52]]
    ],
    right: [
        [[25.5, 55], [34, 54]],
        [[24, 52], [34, 51]],
        [[24, 52], [35.7, 51]],
        [[24, 52], [35.7, 51]]
    ]
});
const HIT_SHADOW_FOOT_PIXELS = Object.freeze({
    left: [[25.5, 54], [36, 55]],
    right: [[27, 55], [37.5, 54]]
});

/**
 * 원본 64×64 셀에서 측정한 발 픽셀의 중심·하단을 정규화합니다.
 * @param {readonly (readonly (readonly number[])[])[]} framePairs - 프레임별 양발 픽셀입니다.
 * @returns {readonly object[]} 프레임별 양발 접점입니다.
 */
function createShadowFootFrames(framePairs) {
    return framePairs.map((pair) => pair.map(([x, y]) => ({
        x: (x + 0.5) / 64,
        y: (y + 1) / 64
    })));
}

/** @param {string} facing @param {number} count @returns {readonly object[]} 고정 자세 발 접점입니다. */
function repeatIdleShadowFeet(facing, count) {
    return createShadowFootFrames(Array.from(
        { length: count },
        () => WALK_SHADOW_FOOT_PIXELS[facing][0]
    ));
}

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
            { column, row: actorRow, castsShadow: true },
            { column, row: effectRow, castsShadow: false }
        ])
    });
}

/**
 * 좌우 대기의 몸을 고정하고 머리만 1픽셀 올리는 호흡 프레임을 만듭니다.
 * @param {'left'|'right'} facing - 원본 좌우 방향입니다.
 * @returns {readonly object[]} 몸·머리 합성 프레임입니다.
 */
function breathingFrames(facing) {
    const bodyColumn = facing === 'left' ? 2 : 3;
    const headColumn = facing === 'left' ? 0 : 1;
    return createTutorialSpriteFrames({
        cellWidth: 64,
        cellHeight: 64,
        frameCells: BREATHING_HEAD_OFFSETS.map((offsetYRatio) => [
            { column: bodyColumn, row: 0, castsShadow: true },
            {
                column: headColumn,
                row: 0,
                offsetYRatio,
                castsShadow: false
            }
        ])
    });
}

const clips = [];
for (const [facing, row] of Object.entries(DIRECTIONS)) {
    const usesBreathingSheet = facing === 'left' || facing === 'right';
    const idleFrameCount = usesBreathingSheet ? BREATHING_HEAD_OFFSETS.length : 1;
    clips.push(createTutorialSpriteClip({
        id: `player.idle.${facing}`,
        actorType: 'player',
        animationId: 'idle',
        facing,
        assetId: usesBreathingSheet ? ASSETS.playerBreathing : ASSETS.playerWalk,
        frames: usesBreathingSheet ? breathingFrames(facing) : rowFrames(row, [0]),
        fps: usesBreathingSheet ? 4 : 1,
        loop: true,
        visualTopInsetRatio: usesBreathingSheet ? 7 / 64 : undefined,
        shadowFootFrames: repeatIdleShadowFeet(facing, idleFrameCount)
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
        shadowFootFrames: createShadowFootFrames(
            WALK_SHADOW_FOOT_PIXELS[facing]
        ),
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
        shadowFootFrames: createShadowFootFrames(
            MELEE_SHADOW_FOOT_PIXELS[facing]
        ),
        impactFrame: 2
    }));
    clips.push(createTutorialSpriteClip({
        id: `player.hit.${facing}`,
        actorType: 'player',
        animationId: 'hit',
        facing,
        assetId: ASSETS.playerHit,
        frames: rowFrames(row, [0, 1, 2, 3]),
        fps: 12,
        shadowFootFrames: createShadowFootFrames(Array.from(
            { length: 4 },
            () => HIT_SHADOW_FOOT_PIXELS[facing]
        ))
    }));
    clips.push(createTutorialSpriteClip({
        id: `player.heal.${facing}`,
        actorType: 'player',
        animationId: 'heal',
        facing,
        assetId: ASSETS.playerHeal,
        frames: rowFrames(row, Array.from({ length: 19 }, (_, index) => index)),
        fps: 18,
        shadowFootFrames: repeatIdleShadowFeet(facing, 19),
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
        shadowFootFrames: repeatIdleShadowFeet(facing, 5),
        impactFrame: 3
    }));
    clips.push(createTutorialSpriteClip({
        id: `player.ranged.${facing}`,
        actorType: 'player',
        animationId: 'ranged',
        facing,
        assetId: ASSETS.playerRanged,
        frames: rowFrames(row, [0, 1, 2, 3, 4, 5, 6]),
        fps: 12,
        impactFrame: 4,
        visualTopInsetRatio: 7 / 64,
        shadowFootFrames: repeatIdleShadowFeet(facing, 7)
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

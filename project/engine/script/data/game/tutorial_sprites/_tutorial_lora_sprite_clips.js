import { TUTORIAL_SPRITE_ASSET_IDS as ASSETS } from '../tutorial_assets/_tutorial_sprite_asset_entries.js';
import {
    createTutorialSpriteClip,
    createTutorialSpriteFrames
} from './_tutorial_sprite_clip_entry.js';

const DIRECTION_ROWS = Object.freeze({ left: 0, right: 1, up: 0, down: 1 });
const BREATHING_HEAD_OFFSETS = Object.freeze([0, -1 / 64, -1 / 64, 0]);
const ACTION_FOOT_PIXELS = Object.freeze({
    idle: Object.freeze(Array.from(
        { length: 4 },
        () => [[29, 54], [34, 55]]
    )),
    melee: Object.freeze([
        [[29, 55], [36, 56]],
        [[28, 54], [37, 55]],
        [[28, 54], [37, 55]],
        [[28, 54], [37, 55]],
        [[28, 54], [37, 55]]
    ]),
    area: Object.freeze(Array.from(
        { length: 6 },
        () => [[30, 55], [35, 56]]
    )),
    hit: Object.freeze(Array.from(
        { length: 4 },
        () => [[25, 55], [30, 57]]
    )),
    unstable: Object.freeze([
        [[29, 55], [35, 53]],
        [[30, 55], [35, 56]],
        [[29, 55], [35, 53]],
        [[30, 55], [35, 56]]
    ]),
    collapse: Object.freeze(Array.from(
        { length: 4 },
        () => [[18, 47], [49, 47]]
    ))
});

/**
 * 원본 좌향 발 접점을 우향 행에 맞춰 좌우 반전합니다.
 * @param {readonly (readonly (readonly number[])[])[]} frames - 좌향 프레임별 양발 픽셀입니다.
 * @returns {readonly (readonly (readonly number[])[])[]} 우향 프레임별 양발 픽셀입니다.
 */
function mirrorFootPixels(frames) {
    return frames.map((feet) => feet.map(([x, y]) => [63 - x, y]).reverse());
}

/**
 * 64×64 원본 셀의 발 픽셀을 정규화된 접점으로 변환합니다.
 * @param {readonly (readonly (readonly number[])[])[]} frames - 프레임별 양발 픽셀입니다.
 * @param {boolean} mirrored - 우향 행 여부입니다.
 * @returns {readonly object[]} 프레임별 양발 접점입니다.
 */
function createShadowFootFrames(frames, mirrored) {
    const source = mirrored ? mirrorFootPixels(frames) : frames;
    return source.map((feet) => feet.map(([x, y]) => ({
        x: (x + 0.5) / 64,
        y: (y + 1) / 64
    })));
}

/** @param {number} row @param {number} count @returns {readonly object[]} 단일 레이어 프레임입니다. */
function rowFrames(row, count) {
    return createTutorialSpriteFrames({
        cellWidth: 64,
        cellHeight: 64,
        frameCells: Array.from({ length: count }, (_, column) => ({ column, row }))
    });
}

/**
 * 로라 몸을 고정하고 머리만 1픽셀 올리는 좌우 호흡 루프를 만듭니다.
 * @param {string} facing - 표시 방향입니다.
 * @returns {readonly object[]} 몸·머리 합성 프레임입니다.
 */
function breathingFrames(facing) {
    const right = facing === 'right' || facing === 'down';
    const bodyColumn = right ? 3 : 0;
    const headColumn = right ? 2 : 1;
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

const ACTIONS = Object.freeze([
    Object.freeze({
        animationId: 'melee', assetId: ASSETS.loraMelee,
        count: 5, fps: 10, impactFrame: 3, visualTopInsetRatio: 14 / 64
    }),
    Object.freeze({
        animationId: 'area', assetId: ASSETS.loraArea,
        count: 6, fps: 10, impactFrame: 3, visualTopInsetRatio: 6 / 64
    }),
    Object.freeze({
        animationId: 'hit', assetId: ASSETS.loraHit,
        count: 4, fps: 12, impactFrame: null, visualTopInsetRatio: 14 / 64
    }),
    Object.freeze({
        animationId: 'unstable', assetId: ASSETS.loraUnstable,
        count: 4, fps: 4, impactFrame: null, loop: true,
        visualTopInsetRatio: 14 / 64
    }),
    Object.freeze({
        animationId: 'collapse', assetId: ASSETS.loraCollapse,
        count: 4, fps: 4, impactFrame: null, loop: true,
        visualTopInsetRatio: 19 / 64
    })
]);

const clips = [];
for (const [facing, row] of Object.entries(DIRECTION_ROWS)) {
    const mirrored = row === 1;
    clips.push(createTutorialSpriteClip({
        id: `lora.idle.${facing}`,
        actorType: 'lora',
        animationId: 'idle',
        facing,
        assetId: ASSETS.loraBreathing,
        frames: breathingFrames(facing),
        fps: 4,
        loop: true,
        visualTopInsetRatio: 13 / 64,
        shadowFootFrames: createShadowFootFrames(
            ACTION_FOOT_PIXELS.idle,
            mirrored
        ),
        scaleTileRatio: 0.94
    }));

    for (const action of ACTIONS) {
        clips.push(createTutorialSpriteClip({
            id: `lora.${action.animationId}.${facing}`,
            actorType: 'lora',
            animationId: action.animationId,
            facing,
            assetId: action.assetId,
            frames: rowFrames(row, action.count),
            fps: action.fps,
            loop: action.loop === true,
            impactFrame: action.impactFrame,
            visualTopInsetRatio: action.visualTopInsetRatio,
            shadowFootFrames: createShadowFootFrames(
                ACTION_FOOT_PIXELS[action.animationId],
                mirrored
            ),
            scaleTileRatio: 0.94
        }));
    }

    clips.push(createTutorialSpriteClip({
        id: `lora.death.${facing}`,
        actorType: 'lora',
        animationId: 'death',
        facing,
        available: false,
        playbackFrameCount: 4,
        fps: 8,
        fallbackClipId: `lora.idle.${facing}`,
        fallbackEffect: 'death',
        terminal: true,
        scaleTileRatio: 0.94
    }));
}

export const TUTORIAL_LORA_SPRITE_CLIPS = Object.freeze(clips);

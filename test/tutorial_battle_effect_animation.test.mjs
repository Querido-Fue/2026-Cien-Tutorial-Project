import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_BATTLE_EFFECT_DATA } from '../project/engine/script/data/game/tutorial_battle_effect_data.js';
import { TUTORIAL_SPRITE_CLIPS } from '../project/engine/script/data/game/tutorial_sprite_clips.js';
import { TutorialBattleAnimationCoordinator } from '../project/engine/script/scene/tutorial/_tutorial_battle_animation_coordinator.js';
import { TutorialBattleEffectAnimator } from '../project/engine/script/scene/tutorial/_tutorial_battle_effect_animator.js';
import { TutorialAttackDistortionAnimator } from '../project/engine/script/scene/tutorial/_tutorial_attack_distortion_animator.js';
import { EFFECT_RENDER_CONSTANTS } from '../project/engine/script/data/display/effect_render_constants.js';
import {
    TUTORIAL_PRESENTATION_CUE_TYPES
} from '../project/engine/script/scene/tutorial/_tutorial_presentation_contract.js';
import { TutorialBattleEffectView } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_effect_view.js';

const CUE_TYPES = TUTORIAL_PRESENTATION_CUE_TYPES;

test('원거리 화살은 발사 프레임 뒤 타일까지 이동하며 실제 도착 시간을 impact로 사용한다', () => {
    const animator = new TutorialBattleEffectAnimator(TUTORIAL_BATTLE_EFFECT_DATA);
    const effectId = 'player-arrow:0';
    const delays = animator.route([{
        type: CUE_TYPES.WORLD_ANIMATION,
        effectId,
        animationId: TUTORIAL_BATTLE_EFFECT_DATA.IDS.PLAYER_ARROW,
        from: { x: 0, y: 0 },
        to: { x: 4, y: 0 },
        facing: 'right'
    }]);
    const launchDelay = 4 / 12;
    const travelSeconds = 4 / 10;

    assert.ok(Math.abs(delays[effectId] - (launchDelay + travelSeconds)) < 1e-9);
    assert.equal(animator.getSnapshot()[0].visible, false);
    const paused = animator.getSnapshot();
    animator.update(0);
    assert.deepEqual(animator.getSnapshot(), paused);
    animator.update(launchDelay + (travelSeconds * 0.5));
    const halfway = animator.getSnapshot()[0];
    assert.equal(halfway.visible, true);
    assert.ok(Math.abs(halfway.progress - 0.5) < 1e-9);
    assert.equal(halfway.sourceRect.w, 24);
    assert.equal(halfway.sourceRect.h, 7);

    animator.update((travelSeconds * 0.5) + 0.001);
    assert.deepEqual(animator.getSnapshot(), []);
    assert.equal(animator.isBusy(), false);
    animator.destroy();
    assert.deepEqual(animator.route([{
        type: CUE_TYPES.WORLD_ANIMATION,
        animationId: TUTORIAL_BATTLE_EFFECT_DATA.IDS.PLAYER_ARROW,
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 }
    }]), {});
});

test('로라 광역 폭발은 과도한 두 번째 플래시 프레임을 건너뛰고 첫 플래시는 감쇠한다', () => {
    const animator = new TutorialBattleEffectAnimator(TUTORIAL_BATTLE_EFFECT_DATA);
    const effectId = 'lora-area-explosion:0';
    const delays = animator.route([{
        type: CUE_TYPES.WORLD_ANIMATION,
        effectId,
        animationId: TUTORIAL_BATTLE_EFFECT_DATA.IDS.LORA_AREA_EXPLOSION
    }]);

    assert.ok(Math.abs(delays[effectId] - (5 / 18)) < 1e-9);
    animator.update((5 / 18) + 1e-6);
    const impact = animator.getSnapshot()[0];
    assert.equal(impact.frameIndex, 5);
    assert.ok(impact.alpha <= 0.34);

    animator.update(2 / 18);
    const afterFlash = animator.getSnapshot()[0];
    assert.equal(afterFlash.playbackFrameIndex, 7);
    assert.equal(afterFlash.frameIndex, 8);
    assert.notEqual(afterFlash.frameIndex, 7);
    assert.equal(afterFlash.sourceRect.x, 8 * 970);

    animator.update(1);
    assert.deepEqual(animator.getSnapshot(), []);
});

test('플레이어 공격 왜곡은 실제 impact까지 대기한 뒤 대상에서 expo 링으로 퍼진다', () => {
    const config = TUTORIAL_BATTLE_EFFECT_DATA.PLAYER_ATTACK_DISTORTION;
    const animator = new TutorialAttackDistortionAnimator(config, {
        resolveImpactDelay: () => 0.2
    });
    animator.route([{
        type: CUE_TYPES.ACTOR_ANIMATION,
        actorId: 'lora',
        animationId: 'hit',
        tile: { x: 4, y: 2 },
        waitForImpact: true,
        impactActorId: 'player',
        impactAnimationId: 'melee',
        impactFacing: 'right'
    }]);

    assert.equal(animator.isBusy(), true);
    assert.equal(animator.getSnapshot()[0].visible, false);
    animator.update(0.2);
    const impact = animator.getSnapshot()[0];
    assert.equal(impact.visible, true);
    assert.equal(impact.progress, 0);
    assert.equal(impact.intensity, 1);
    assert.deepEqual(impact.tile, { x: 4, y: 2 });

    animator.update(config.DURATION_SECONDS * 0.5);
    const spreading = animator.getSnapshot()[0];
    assert.ok(spreading.radiusProgress > 0.95);
    assert.ok(spreading.intensity > 0 && spreading.intensity < 1);
    animator.update((config.DURATION_SECONDS * 0.5) + 0.001);
    assert.deepEqual(animator.getSnapshot(), []);
    assert.equal(animator.isBusy(), false);
});

test('통합 코디네이터는 배우 타격보다 늦은 화살 도착 시각까지 피해 cue와 입력 잠금을 지연한다', () => {
    const coordinator = new TutorialBattleAnimationCoordinator({
        spriteClips: TUTORIAL_SPRITE_CLIPS,
        effectData: TUTORIAL_BATTLE_EFFECT_DATA
    });
    coordinator.update(0, {
        floor: { mobs: [] },
        snapshot: {
            floorIndex: 0,
            player: { x: 0, y: 0, hp: 100, alive: true },
            lora: { x: 4, y: 0, hp: 100, alive: true, instability: 0 }
        },
        presentation: { floorIndex: 0, playerX: 0, playerY: 0 }
    });
    const effectId = 'player-arrow:1';
    const routed = coordinator.route([
        {
            type: CUE_TYPES.WORLD_ANIMATION,
            effectId,
            animationId: TUTORIAL_BATTLE_EFFECT_DATA.IDS.PLAYER_ARROW,
            from: { x: 0, y: 0 },
            to: { x: 4, y: 0 },
            facing: 'right'
        },
        {
            type: CUE_TYPES.ACTOR_ANIMATION,
            actorId: 'player',
            animationId: 'ranged',
            facing: 'right'
        },
        {
            type: CUE_TYPES.FLASH,
            impactActorId: 'player',
            impactAnimationId: 'ranged',
            impactFacing: 'right',
            impactEffectId: effectId
        },
        {
            type: CUE_TYPES.ACTOR_ANIMATION,
            actorId: 'lora',
            animationId: 'hit',
            waitForImpact: true,
            impactActorId: 'player',
            impactAnimationId: 'ranged',
            impactFacing: 'right',
            impactEffectId: effectId
        }
    ]);

    assert.ok(Math.abs(routed[2].delaySeconds - ((4 / 12) + (4 / 10))) < 1e-9);
    assert.equal(coordinator.isBusy(), true);
    assert.equal(coordinator.snapshot().battleEffects.length, 2);
    assert.equal(coordinator.snapshot().battleEffects[1].visible, false);
    coordinator.reset();
    assert.equal(coordinator.isBusy(), false);
    coordinator.destroy();
});

test('월드 효과 뷰는 화살을 WebGL effect에, 폭발 크롭을 2D texteffect에 그린다', () => {
    const glCommands = [];
    const drawCommands = [];
    const images = {
        arrow: { width: 1216, height: 192 },
        explosion: { width: 12610, height: 580 }
    };
    const view = new TutorialBattleEffectView({
        renderGL(layer, options) {
            glCommands.push({ layer, ...options });
        },
        render(layer, options) {
            drawCommands.push({ layer, ...options });
        }
    }, {
        getImage: (assetId) => images[assetId]
    });
    view.draw({
        layout: {
            isoOriginX: 100,
            isoOriginY: 100,
            gridAxisX: { x: 32, y: 16 },
            gridAxisY: { x: -32, y: 16 },
            tileElevation: 0,
            tileSide: 40,
            heights: [[0, 0, 0]],
            shake: { x: 0, y: 0 },
            mapImageRect: { x: 10, y: 20, w: 970, h: 580 }
        },
        world: {
            battleEffects: [
                {
                    type: 'arrow', visible: true, assetId: 'arrow',
                    sourceRect: { x: 84, y: 156, w: 24, h: 7 },
                    from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, progress: 0.5,
                    sizeTileRatio: 0.72, arcHeightTileRatio: 0.16,
                    alpha: 1, layer: 'effect'
                },
                {
                    type: 'area-explosion', visible: true, assetId: 'explosion',
                    sourceRect: { x: 5 * 970, y: 0, w: 970, h: 580 },
                    alpha: 0.3, layer: 'texteffect'
                },
                {
                    type: 'spatial-distortion', visible: true,
                    tile: { x: 2, y: 0 }, progress: 0.4, radiusProgress: 0.8,
                    intensity: 0.65, minRadiusTileRatio: 0.18,
                    maxRadiusTileRatio: 2.55, ringWidthTileRatio: 0.48,
                    strengthTileRatio: 0.14, centerYOffsetTileRatio: -0.28,
                    alpha: 1, layer: 'effect'
                }
            ]
        }
    });

    assert.equal(glCommands.length, 2);
    assert.equal(glCommands[0].layer, 'effect');
    assert.equal(glCommands[0].smoothing, false);
    assert.equal([glCommands[0].x, glCommands[0].y, glCommands[0].w, glCommands[0].h]
        .every(Number.isInteger), true);
    assert.equal(
        glCommands[1].effectType,
        EFFECT_RENDER_CONSTANTS.TYPES.SPATIAL_DISTORTION
    );
    assert.equal(glCommands[1].layer, 'effect');
    assert.ok(glCommands[1].radius > 0);
    assert.ok(glCommands[1].ringWidth > 0);
    assert.ok(glCommands[1].strength > 0);
    assert.equal(drawCommands.length, 1);
    assert.deepEqual(drawCommands[0], {
        layer: 'texteffect',
        shape: 'image',
        image: images.explosion,
        sourceRect: { x: 5 * 970, y: 0, w: 970, h: 580 },
        x: 10,
        y: 20,
        w: 970,
        h: 580,
        alpha: 0.3,
        smoothing: false
    });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_SPRITE_CLIPS } from '../project/engine/script/data/game/tutorial_sprite_clips.js';
import { TutorialSpriteAnimator } from '../project/engine/script/scene/tutorial/_tutorial_sprite_animator.js';
import { TutorialSpriteClipResolver } from '../project/engine/script/scene/tutorial/_tutorial_sprite_clip_resolver.js';
import { TutorialSpriteCueRouter } from '../project/engine/script/scene/tutorial/_tutorial_sprite_cue_router.js';
import { TutorialSpriteRoster } from '../project/engine/script/scene/tutorial/_tutorial_sprite_roster.js';
import {
    TUTORIAL_AUDIO_CUE_IDS,
    TUTORIAL_PRESENTATION_CUE_TYPES
} from '../project/engine/script/scene/tutorial/_tutorial_presentation_contract.js';

function createAnimator() {
    return new TutorialSpriteAnimator({
        resolver: new TutorialSpriteClipResolver(TUTORIAL_SPRITE_CLIPS)
    });
}

test('로라는 플레이어 위치를 따라 전면 좌우 방향만 선택한다', () => {
    const snapshots = [];
    const roster = new TutorialSpriteRoster({
        syncActors(actors) {
            snapshots.push(actors);
        }
    });
    const cases = [
        { player: { x: 4, y: 4 }, lora: { x: 4, y: 0 }, expected: 'left' },
        { player: { x: 4, y: 0 }, lora: { x: 4, y: 4 }, expected: 'right' },
        { player: { x: 2, y: 4 }, lora: { x: 4, y: 4 }, expected: 'left' },
        { player: { x: 6, y: 4 }, lora: { x: 4, y: 4 }, expected: 'right' }
    ];
    for (const entry of cases) {
        roster.sync({
            floor: { mobs: [] },
            snapshot: {
                floorIndex: 0,
                player: { ...entry.player, hp: 100, alive: true },
                lora: { ...entry.lora, hp: 100, alive: true, instability: 70 }
            },
            presentation: {
                floorIndex: 0,
                playerX: entry.player.x,
                playerY: entry.player.y
            }
        });

        const lora = snapshots.at(-1).find((actor) => actor.id === 'lora');
        assert.equal(lora.facing, entry.expected);
        assert.equal(['left', 'right'].includes(lora.facing), true);
    }
});

test('로라의 동·서 방향은 같은 전면 프레임을 사용하고 서쪽만 좌우 반전한다', () => {
    const animator = createAnimator();
    animator.syncActors([{
        id: 'lora', actorType: 'lora', x: 4, y: 0,
        alive: true, facing: 'right', ambientAnimationId: 'idle'
    }]);
    const east = animator.getSnapshot().lora;
    animator.syncActors([{
        id: 'lora', actorType: 'lora', x: 4, y: 0,
        alive: true, facing: 'left', ambientAnimationId: 'idle'
    }]);
    const west = animator.getSnapshot().lora;

    assert.deepEqual(west.layers, east.layers);
    assert.equal(east.flipX, false);
    assert.equal(west.flipX, true);
    assert.notDeepEqual(west.shadowFootAnchors, east.shadowFootAnchors);
});

test('걷기 루프는 델타로 진행하고 지정 프레임에서 발걸음을 발생시킨다', () => {
    const animator = createAnimator();
    animator.syncActors([{
        id: 'player', actorType: 'player', x: 0, y: 0,
        alive: true, detectMovement: true
    }]);
    animator.syncActors([{
        id: 'player', actorType: 'player', x: 1, y: 0,
        alive: true, detectMovement: true
    }]);
    assert.equal(animator.getSnapshot().player.animationId, 'walk');
    assert.equal(animator.getSnapshot().player.facing, 'right');
    assert.equal(animator.getSnapshot().player.visualTopInsetRatio, 0.125);
    const initialFeet = animator.getSnapshot().player.shadowFootAnchors;
    assert.equal(initialFeet.length, 2);

    animator.update(0.13);
    assert.equal(animator.getSnapshot().player.frameIndex, 1);
    assert.equal(animator.getSnapshot().player.shadowFootAnchors.length, 2);
    assert.notDeepEqual(animator.getSnapshot().player.shadowFootAnchors, initialFeet);
    assert.equal(animator.drainEvents().filter(({ id }) => id === 'footstep').length, 1);
    animator.update(0.5);
    assert.ok(animator.getSnapshot().player.frameIndex >= 0);
    assert.ok(animator.getSnapshot().player.frameIndex < 4);
});

test('비루프 타격은 impact를 한 번만 내고 완료 뒤 ambient로 복귀한다', () => {
    const animator = createAnimator();
    animator.syncActors([{
        id: 'player', actorType: 'player', x: 0, y: 0, alive: true
    }]);
    assert.equal(animator.play('player', 'melee', { facing: 'right' }), true);
    assert.equal(animator.hasBlockingAnimation(), true);
    animator.update(0.21);
    assert.equal(animator.getSnapshot().player.frameIndex, 2);
    assert.equal(animator.drainEvents().filter(({ id }) => id === 'impact').length, 1);
    animator.update(0.1);
    assert.equal(animator.drainEvents().filter(({ id }) => id === 'impact').length, 0);
    animator.update(0.2);
    assert.equal(animator.getSnapshot().player.animationId, 'idle');
    assert.equal(animator.getSnapshot().player.locked, false);
    assert.equal(animator.hasBlockingAnimation(), false);
});

test('로라 공격 뒤 붕괴 상태도 확대·축소 없이 느린 부유로 복귀한다', () => {
    const animator = createAnimator();
    animator.syncActors([{
        id: 'lora', actorType: 'lora', x: 4, y: 0, alive: true,
        facing: 'left', ambientAnimationId: 'unstable'
    }]);
    assert.equal(animator.play('lora', 'melee', { facing: 'left' }), true);
    animator.syncActors([{
        id: 'lora', actorType: 'lora', x: 4, y: 0, alive: true,
        facing: 'left', ambientAnimationId: 'collapse'
    }]);

    animator.update(1);
    const snapshot = animator.getSnapshot().lora;
    assert.equal(snapshot.animationId, 'collapse');
    assert.equal(snapshot.fallbackEffect, 'breathing');
    assert.equal(snapshot.locked, false);
});

test('높은 우선순위 피격은 행동을 중단하고 큰 델타에도 잠금을 남기지 않는다', () => {
    const animator = createAnimator();
    animator.syncActors([{
        id: 'player', actorType: 'player', x: 0, y: 0, alive: true
    }]);
    assert.equal(animator.play('player', 'melee', { facing: 'left' }), true);
    assert.equal(animator.play('player', 'item', { facing: 'left' }), false);
    assert.equal(animator.play('player', 'hit', { facing: 'left' }), true);
    assert.equal(animator.getSnapshot().player.animationId, 'hit');

    animator.update(10);
    assert.equal(animator.getSnapshot().player.animationId, 'idle');
    assert.equal(animator.getSnapshot().player.locked, false);
});

test('사망과 destroy는 표시·트랙·이벤트 수명을 명시적으로 종료한다', () => {
    const animator = createAnimator();
    animator.syncActors([{
        id: 'mob-1', actorType: 'slime', variant: 'green',
        x: 0, y: 0, alive: true
    }]);
    assert.equal(animator.play('mob-1', 'death'), true);
    animator.update(1);
    assert.equal(animator.getSnapshot()['mob-1'].visible, false);
    assert.equal(animator.getSnapshot()['mob-1'].locked, false);
    animator.drainEvents();

    animator.syncActors([{
        id: 'player', actorType: 'player', x: 0, y: 0, alive: false
    }]);
    assert.equal(animator.play('player', 'death'), true);
    animator.update(1);
    assert.equal(animator.getSnapshot().player.visible, true);
    assert.equal(animator.getSnapshot().player.completed, true);
    assert.equal(animator.drainEvents().filter(({ id }) => id === 'complete').length, 1);
    animator.update(1);
    assert.equal(animator.drainEvents().filter(({ id }) => id === 'complete').length, 0);
    animator.destroy();
    assert.equal(animator.getTrackCount(), 0);
    assert.deepEqual(animator.drainEvents(), []);
});

test('cue 라우터는 피해 연출을 공격 impact까지 지연하고 발걸음 오디오를 파생한다', () => {
    const animator = createAnimator();
    const derived = [];
    const router = new TutorialSpriteCueRouter({
        animator,
        onCue: (cue) => derived.push(cue)
    });
    animator.syncActors([
        { id: 'player', actorType: 'player', x: 0, y: 0, alive: true },
        { id: 'lora', actorType: 'lora', x: 1, y: 0, alive: true }
    ]);
    const routed = router.route([
        {
            type: TUTORIAL_PRESENTATION_CUE_TYPES.ACTOR_ANIMATION,
            actorId: 'player', animationId: 'melee', facing: 'right'
        },
        {
            type: TUTORIAL_PRESENTATION_CUE_TYPES.ACTOR_ANIMATION,
            actorId: 'lora', animationId: 'hit', waitForImpact: true,
            impactActorId: 'player', impactAnimationId: 'melee', impactFacing: 'right'
        },
        {
            type: TUTORIAL_PRESENTATION_CUE_TYPES.FLASH,
            duration: 0.2,
            impactActorId: 'player', impactAnimationId: 'melee', impactFacing: 'right'
        }
    ]);
    assert.equal(routed[2].delaySeconds, 0.2);
    assert.equal(router.isBusy(), true);
    animator.syncActors([
        { id: 'player', actorType: 'player', x: 0, y: 0, alive: true },
        { id: 'lora', actorType: 'lora', x: 1, y: 0, alive: false }
    ]);
    assert.equal(animator.getSnapshot().lora.animationId, 'idle');
    router.update(0.19);
    assert.equal(animator.getSnapshot().lora.animationId, 'idle');
    router.update(0.02);
    assert.equal(animator.getSnapshot().lora.animationId, 'hit');
    assert.equal(router.isBusy(), true);
    router.update(1);
    assert.equal(router.isBusy(), false);

    router.reset();
    animator.syncActors([{
        id: 'player', actorType: 'player', x: 0, y: 0,
        alive: true, detectMovement: true
    }]);
    animator.syncActors([{
        id: 'player', actorType: 'player', x: 1, y: 0,
        alive: true, detectMovement: true
    }]);
    router.update(0.13);
    assert.equal(derived.some((cue) => (
        cue.type === TUTORIAL_PRESENTATION_CUE_TYPES.AUDIO
        && cue.id === TUTORIAL_AUDIO_CUE_IDS.PLAYER_FOOTSTEP
    )), true);
    router.destroy();
});

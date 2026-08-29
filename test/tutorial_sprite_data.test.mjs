import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TUTORIAL_ASSET_MANIFEST } from '../project/engine/script/data/game/tutorial_asset_manifest.js';
import { TUTORIAL_SPRITE_CLIPS } from '../project/engine/script/data/game/tutorial_sprite_clips.js';
import { TutorialSpriteClipResolver } from '../project/engine/script/scene/tutorial/_tutorial_sprite_clip_resolver.js';

test('32×32 논리 클립 계약은 필수 배우 동작과 실제 시트 경계를 모두 선언한다', () => {
    assert.deepEqual(TUTORIAL_SPRITE_CLIPS.LOGICAL_FRAME_SIZE, {
        width: 32,
        height: 32
    });
    const clips = Object.values(TUTORIAL_SPRITE_CLIPS.CLIPS);
    const requiredAnimations = {
        player: ['idle', 'walk', 'melee', 'ranged', 'item', 'heal', 'hit', 'death'],
        lora: ['idle', 'melee', 'area', 'hit', 'unstable', 'collapse', 'death'],
        slime: ['idle', 'attack', 'hit', 'death']
    };
    for (const [actorType, animationIds] of Object.entries(requiredAnimations)) {
        const present = new Set(clips
            .filter((clip) => clip.actorType === actorType)
            .map((clip) => clip.animationId));
        for (const animationId of animationIds) {
            assert.equal(present.has(animationId), true, `${actorType}.${animationId}`);
        }
    }

    const dimensionsByAssetId = Object.fromEntries(
        TUTORIAL_ASSET_MANIFEST.ENTRIES.map((entry) => [entry.id, entry.expectedDimensions])
    );
    for (const clip of clips.filter((entry) => entry.available)) {
        const assetIds = clip.assetIds ? Object.values(clip.assetIds) : [clip.assetId];
        for (const assetId of assetIds) {
            assert.ok(dimensionsByAssetId[assetId], `${clip.id}: ${assetId}`);
        }
        for (const frame of clip.frames) {
            for (const rect of frame.layers) {
                assert.equal([rect.x, rect.y, rect.w, rect.h].every(Number.isInteger), true);
                assert.ok(rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0);
                for (const assetId of assetIds) {
                    const dimensions = dimensionsByAssetId[assetId];
                    assert.ok(rect.x + rect.w <= dimensions.width, `${clip.id} x 경계`);
                    assert.ok(rect.y + rect.h <= dimensions.height, `${clip.id} y 경계`);
                }
            }
        }
        assert.equal(clip.logicalSize.width, 32);
        assert.equal(clip.logicalSize.height, 32);
        assert.equal(clip.anchor.x, 0.5);
        assert.ok(clip.anchor.y >= 0.8 && clip.anchor.y <= 1);
        assert.ok(clip.visualTopInsetRatio >= 0 && clip.visualTopInsetRatio < 1);
    }

    const visualTopInsets = { player: 0.125, lora: 0.257, slime: 0.66 };
    for (const [actorType, inset] of Object.entries(visualTopInsets)) {
        const actorClips = clips.filter((clip) => clip.actorType === actorType);
        assert.ok(actorClips.length > 0, actorType);
        assert.equal(
            actorClips.every((clip) => clip.visualTopInsetRatio === inset),
            true,
            `${actorType} 실제 픽셀 상단 보정`
        );
    }
});

test('원본이 없는 Range·Breathing·로라 액션은 순환 없는 명시적 폴백으로 해석된다', () => {
    const clips = TUTORIAL_SPRITE_CLIPS.CLIPS;
    for (const clip of Object.values(clips).filter((entry) => !entry.available)) {
        assert.equal(typeof clip.fallbackClipId, 'string', clip.id);
        const visited = new Set([clip.id]);
        let current = clip;
        while (current.available === false) {
            current = clips[current.fallbackClipId];
            assert.ok(current, `${clip.id}: 끊어진 폴백`);
            assert.equal(visited.has(current.id), false, `${clip.id}: 순환 폴백`);
            visited.add(current.id);
        }
    }

    const resolver = new TutorialSpriteClipResolver(TUTORIAL_SPRITE_CLIPS);
    const ranged = resolver.resolve({
        actorType: 'player', animationId: 'ranged', facing: 'right'
    });
    assert.equal(ranged.requestedClipId, 'player.ranged.right');
    assert.equal(ranged.resolvedClipId, 'player.item.right');
    assert.equal(ranged.fallbackUsed, true);
    assert.equal(ranged.fallbackEffect, 'ranged');
    assert.equal(ranged.visualTopInsetRatio, 0.125);

    const unstable = resolver.resolve({
        actorType: 'lora', animationId: 'unstable', facing: 'down'
    });
    assert.equal(unstable.resolvedClipId, 'lora.idle.down');
    assert.equal(unstable.frames.length, 4);
    assert.equal(unstable.fps, 2);
    assert.equal(unstable.loop, true);
    assert.equal(unstable.fallbackEffect, 'breathing');
    assert.equal(unstable.visualTopInsetRatio, 0.257);

    const slime = resolver.resolve({
        actorType: 'slime', animationId: 'idle', variant: 'blue'
    });
    assert.equal(slime.visualTopInsetRatio, 0.66);
});

test('매니페스트는 실제 8개 스프라이트 시트를 픽셀 렌더 자산으로 등록한다', () => {
    const ids = Object.values(TUTORIAL_ASSET_MANIFEST.SPRITES);
    assert.equal(ids.length, 8);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
        const entry = TUTORIAL_ASSET_MANIFEST.ENTRIES.find((candidate) => candidate.id === id);
        assert.ok(entry, id);
        assert.equal(entry.type, 'image/png');
        assert.equal(entry.pixelated, true);
        assert.equal(entry.layer, 'world-actor');
    }
});

test('스프라이트 런타임은 파일당 한 클래스와 장면 역참조 금지를 지킨다', async () => {
    const files = [
        '_tutorial_sprite_clip_resolver.js',
        '_tutorial_sprite_animator.js',
        '_tutorial_sprite_cue_router.js',
        '_tutorial_sprite_roster.js',
        'view/_tutorial_battle_actor_view.js'
    ];
    for (const file of files) {
        const source = await readFile(new URL(
            `../project/engine/script/scene/tutorial/${file}`,
            import.meta.url
        ), 'utf8');
        assert.equal((source.match(/export class /g) || []).length, 1, file);
        for (const forbidden of [
            '_tutorial_scene.js',
            '_tutorial_battle_model.js',
            '_tutorial_meta_progress.js',
            'simulation_command_queue.js'
        ]) {
            assert.equal(source.includes(forbidden), false, `${file} -> ${forbidden}`);
        }
    }
});

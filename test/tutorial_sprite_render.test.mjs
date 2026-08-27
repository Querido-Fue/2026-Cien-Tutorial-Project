import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveImageTextureCoordinates } from '../project/engine/script/display/webgl/_image_texture_coordinates.js';
import { TutorialBattleActorView } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_actor_view.js';

test('sourceRect와 축 반전은 이미지 크기에 맞는 WebGL UV로 변환된다', () => {
    const image = { width: 256, height: 256 };
    assert.deepEqual(resolveImageTextureCoordinates(
        image,
        { x: 64, y: 128, w: 64, h: 64 }
    ), { u0: 0.25, v0: 0.5, u1: 0.5, v1: 0.75 });
    assert.deepEqual(resolveImageTextureCoordinates(
        image,
        { x: 64, y: 128, w: 64, h: 64 },
        { flipX: true }
    ), { u0: 0.5, v0: 0.5, u1: 0.25, v1: 0.75 });
    assert.deepEqual(resolveImageTextureCoordinates(
        image,
        { x: -1, y: 0, w: 64, h: 64 }
    ), { u0: 0, v0: 0, u1: 1, v1: 1 });
});

test('배우 뷰는 정수 좌표·nearest·발 앵커를 유지하며 다중 레이어를 같은 위치에 그린다', () => {
    const commands = [];
    const image = { width: 1216, height: 256 };
    const view = new TutorialBattleActorView({
        renderGL(layer, options) {
            commands.push({ layer, ...options });
        },
        render() {}
    }, {
        getImage: () => image
    });
    const animation = {
        assetId: 'sprite.player.melee',
        layers: [
            { x: 128, y: 128, w: 64, h: 64 },
            { x: 128, y: 192, w: 64, h: 64 }
        ],
        logicalSize: { width: 32, height: 32 },
        anchor: { x: 0.5, y: 0.88 },
        scaleTileRatio: 1,
        progress: 0.5,
        visible: true
    };
    const frame = {
        fonts: { HEADING: '16px sans-serif' },
        colors: {
            Entity: {
                Shadow: '#000', PlayerDark: '#111', Player: '#222', PlayerAccent: '#fff'
            },
            UI: { HpEmpty: '#000', HpFull: '#0f0', Success: '#0f0', Danger: '#f00' }
        },
        layout: {
            isoOriginX: 100,
            isoOriginY: 100,
            tileWidth: 64,
            tileHeight: 32,
            tileElevation: 0,
            tileSide: 40,
            heights: [[0]],
            shake: { x: 0, y: 0 }
        },
        world: {
            presentation: {
                playerX: 0, playerY: 0, playerAlpha: 1,
                playerScale: 1, playerHp: 100, actionPulse: 0
            },
            spriteAnimations: { player: animation },
            config: { actionPlayerScale: 0.04, shadowOffsetRatio: 0.08 },
            readability: {}
        }
    };
    view.draw('player', { hp: 100, maxHp: 100 }, frame);
    const images = commands.filter((command) => command.image === image);
    assert.equal(images.length, 2);
    assert.deepEqual(images.map(({ sourceRect }) => sourceRect), animation.layers);
    assert.equal(images.every(({ smoothing }) => smoothing === false), true);
    assert.equal(images.every(({ x, y, w, h }) => [x, y, w, h].every(Number.isInteger)), true);
    assert.deepEqual(
        images.map(({ x, y, w, h }) => ({ x, y, w, h })),
        [{ x: 80, y: 65, w: 40, h: 40 }, { x: 80, y: 65, w: 40, h: 40 }]
    );
    assert.ok(Math.abs((images[0].y + (images[0].h * animation.anchor.y)) - 100) <= 1);
});

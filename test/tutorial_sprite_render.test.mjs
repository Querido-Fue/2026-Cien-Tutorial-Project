import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveImageTextureCoordinates } from '../project/engine/script/display/webgl/_image_texture_coordinates.js';
import { TutorialBattleActorView } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_actor_view.js';

const SHADOW_PROJECTION = Object.freeze({
    GRID_AXIS_X_WEIGHT: 1,
    GRID_AXIS_Y_WEIGHT: 0,
    LENGTH_SPRITE_HEIGHT_RATIO: 1.18,
    NEAR_WIDTH_SPRITE_RATIO: 0.72,
    FAR_WIDTH_SPRITE_RATIO: 0.98,
    BAND_COUNT: 4,
    NEAR_ALPHA: 1,
    FAR_ALPHA: 0.52,
    CONTACT_WIDTH_SIZE_RATIO: 0.42,
    CONTACT_HEIGHT_SIZE_RATIO: 0.12,
    CONTACT_OFFSET_SIZE_RATIO: 0.03,
    CONTACT_ALPHA: 0.92
});

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
            gridAxisX: { x: 32, y: 16 },
            gridAxisY: { x: -32, y: 16 },
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
            config: {
                actionPlayerScale: 0.04,
                shadowProjection: SHADOW_PROJECTION
            },
            readability: {}
        }
    };
    view.draw('player', { hp: 100, maxHp: 100 }, frame);
    const images = commands.filter(
        (command) => command.image === image && !command.vertices
    );
    const projectedShadows = commands.filter(
        (command) => command.image === image && Array.isArray(command.vertices)
    );
    assert.equal(images.length, 2);
    assert.deepEqual(images.map(({ sourceRect }) => sourceRect), animation.layers);
    assert.equal(images.every(({ smoothing }) => smoothing === false), true);
    assert.equal(images.every(({ x, y, w, h }) => [x, y, w, h].every(Number.isInteger)), true);
    assert.deepEqual(
        images.map(({ x, y, w, h }) => ({ x, y, w, h })),
        [{ x: 80, y: 65, w: 40, h: 40 }, { x: 80, y: 65, w: 40, h: 40 }]
    );
    assert.ok(Math.abs((images[0].y + (images[0].h * animation.anchor.y)) - 100) <= 1);
    assert.equal(projectedShadows.length, animation.layers.length * 4);
    assert.equal(
        projectedShadows.every((command) => (
            command.fill === '#000'
            && command.smoothing === false
            && command.vertices.length === 8
            && command.vertices.every(Number.isInteger)
        )),
        true
    );
    const firstLayerShadows = projectedShadows.filter(
        (command) => command.sourceRect.y < animation.layers[1].y
    );
    assert.deepEqual(
        firstLayerShadows.map((command) => command.sourceRect.h),
        [16, 16, 16, 16]
    );
    assert.equal(
        firstLayerShadows.every((command, index, list) => (
            index === 0 || command.alpha > list[index - 1].alpha
        )),
        true,
        '그림자는 발밑에 가까울수록 진해져야 합니다.'
    );
    const farEdge = firstLayerShadows[0].vertices;
    const nearEdge = firstLayerShadows.at(-1).vertices;
    const farCenter = {
        x: (farEdge[0] + farEdge[2]) * 0.5,
        y: (farEdge[1] + farEdge[3]) * 0.5
    };
    const nearCenter = {
        x: (nearEdge[4] + nearEdge[6]) * 0.5,
        y: (nearEdge[5] + nearEdge[7]) * 0.5
    };
    assert.ok(farCenter.x > nearCenter.x && farCenter.y > nearCenter.y);
    assert.ok(commands.some((command) => (
        command.shape === 'circle'
        && command.fill === '#000'
        && Array.isArray(command.vertices)
    )), '발 위치에는 작은 접지 그림자가 있어야 합니다.');
    assert.equal(commands.some((command) => (
        command.shape === 'circle'
        && command.fill === '#000'
        && !command.vertices
    )), false, '기존의 큰 축 정렬 타원 그림자는 남지 않아야 합니다.');
    const hpBar = commands.find(
        (command) => command.shape === 'rect' && command.fill === '#000'
    );
    assert.ok(
        hpBar.y + (hpBar.h * 0.5) < images[0].y,
        '플레이어 HP 바는 실제 스프라이트 머리 위에 있어야 합니다.'
    );
});

test('월드 HP 바는 캐릭터별 스프라이트 크기와 발 앵커에 맞춰 머리 위에 놓인다', () => {
    const image = { width: 256, height: 256 };
    const cases = [
        {
            type: 'player',
            actor: { hp: 100, maxHp: 100 },
            animationKey: 'player',
            animation: {
                scaleTileRatio: 1.6,
                anchor: { x: 0.5, y: 0.92 },
                visualTopInsetRatio: 0.125
            }
        },
        {
            type: 'lora',
            actor: { x: 0, y: 0, hp: 100, maxHp: 100, alive: true },
            animationKey: 'lora',
            animation: {
                scaleTileRatio: 1.2,
                anchor: { x: 0.5, y: 0.84 },
                visualTopInsetRatio: 0.257
            }
        },
        {
            type: 'mob',
            actor: { id: 'slime', x: 0, y: 0, hp: 100, maxHp: 100 },
            animationKey: 'slime',
            animation: {
                scaleTileRatio: 0.8,
                anchor: { x: 0.5, y: 0.68 },
                visualTopInsetRatio: 0.66
            }
        }
    ];

    for (const actorCase of cases) {
        const commands = [];
        const animation = {
            assetId: `sprite.${actorCase.type}`,
            layers: [{ x: 0, y: 0, w: 32, h: 32 }],
            logicalSize: { width: 32, height: 32 },
            progress: 0,
            visible: true,
            ...actorCase.animation
        };
        const view = new TutorialBattleActorView({
            renderGL(layer, options) {
                commands.push({ layer, ...options });
            },
            render() {}
        }, {
            getImage: () => image
        });
        const frame = {
            fonts: { HEADING: '16px sans-serif' },
            colors: {
                Entity: {
                    Shadow: '#shadow', PlayerDark: '#player-dark',
                    Player: '#player', PlayerAccent: '#player-accent',
                    LoraDark: '#lora-dark', Lora: '#lora',
                    LoraAccent: '#lora-accent', LoraHair: '#lora-hair',
                    MobDark: '#mob-dark', Mob: '#mob'
                },
                Effects: { Stabilize: '#stabilize' },
                UI: {
                    HpEmpty: '#hp-empty', HpFull: '#hp-full',
                    Success: '#success', Danger: '#danger', Text: '#text'
                }
            },
            layout: {
                isoOriginX: 100,
                isoOriginY: 100,
                gridAxisX: { x: 32, y: 16 },
                gridAxisY: { x: -32, y: 16 },
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
                    playerScale: 1, playerHp: 100, loraHp: 100,
                    actionPulse: 0
                },
                spriteAnimations: { [actorCase.animationKey]: animation },
                feedback: { flashSeconds: 0, stabilizeSeconds: 0 },
                config: {
                    actionPlayerScale: 0.04,
                    actionLoraScale: 0.04,
                    shadowProjection: SHADOW_PROJECTION,
                    loraSprite: {
                        BASE_SIZE_TILE_RATIO: 0.8,
                        FLOAT_AMPLITUDE_TILE_RATIO: 0.08,
                        FLASH_GLOW_SIZE_RATIO: 1.12,
                        FLASH_GLOW_ALPHA: 0.2
                    }
                },
                readability: {}
            }
        };

        view.draw(actorCase.type, actorCase.actor, frame);
        const sprite = commands.find(
            (command) => command.image === image && !command.vertices
        );
        const hpBar = commands.find(
            (command) => command.shape === 'rect' && command.fill === '#hp-empty'
        );
        assert.ok(sprite, `${actorCase.type} 스프라이트가 그려져야 합니다.`);
        assert.ok(hpBar, `${actorCase.type} HP 바가 그려져야 합니다.`);
        const visualTopY = sprite.y
            + (sprite.h * animation.visualTopInsetRatio);
        const hpBarBottom = hpBar.y + (hpBar.h * 0.5);
        assert.ok(
            hpBarBottom < visualTopY,
            `${actorCase.type} HP 바가 머리와 겹치지 않아야 합니다.`
        );
        assert.ok(
            visualTopY - hpBarBottom <= hpBar.h,
            `${actorCase.type} HP 바가 머리에서 과도하게 떨어지지 않아야 합니다.`
        );
    }
});

test('로라 불안정 대기는 크기 변화 없이 지면 그림자 위를 천천히 부유한다', () => {
    const image = { width: 296, height: 296 };
    const drawAt = (progress) => {
        const commands = [];
        const view = new TutorialBattleActorView({
            renderGL(layer, options) {
                commands.push({ layer, ...options });
            },
            render() {}
        }, {
            getImage: () => image
        });
        view.draw('lora', {
            x: 0, y: 0, hp: 100, maxHp: 100, alive: true
        }, {
            fonts: { HEADING: '16px sans-serif' },
            colors: {
                Entity: {
                    Shadow: '#shadow', LoraDark: '#lora-dark',
                    Lora: '#lora', LoraAccent: '#lora-accent', LoraHair: '#lora-hair'
                },
                Effects: { Stabilize: '#stabilize' },
                UI: {
                    HpEmpty: '#hp-empty', HpFull: '#hp-full',
                    Success: '#success', Danger: '#danger'
                }
            },
            layout: {
                isoOriginX: 100,
                isoOriginY: 100,
                gridAxisX: { x: 32, y: 16 },
                gridAxisY: { x: -32, y: 16 },
                tileWidth: 64,
                tileHeight: 32,
                tileElevation: 0,
                tileSide: 40,
                heights: [[0]],
                shake: { x: 0, y: 0 }
            },
            world: {
                presentation: { loraHp: 100, actionPulse: 0 },
                spriteAnimations: {
                    lora: {
                        assetId: 'sprite.lora',
                        layers: [{ x: 0, y: 0, w: 74, h: 74 }],
                        logicalSize: { width: 32, height: 32 },
                        anchor: { x: 0.5, y: 0.84 },
                        scaleTileRatio: 0.94,
                        fallbackEffect: 'breathing',
                        progress,
                        visible: true
                    }
                },
                feedback: { flashSeconds: 0, stabilizeSeconds: 0 },
                config: {
                    actionLoraScale: 0.08,
                    shadowProjection: SHADOW_PROJECTION,
                    loraSprite: {
                        BASE_SIZE_TILE_RATIO: 0.64,
                        FLOAT_AMPLITUDE_TILE_RATIO: 0.08,
                        FLASH_GLOW_SIZE_RATIO: 1.08,
                        FLASH_GLOW_ALPHA: 0.34
                    }
                },
                readability: {}
            }
        });
        return commands;
    };

    const highCommands = drawAt(0.25);
    const lowCommands = drawAt(0.75);
    const highSprite = highCommands.find(
        (command) => command.image === image && !command.vertices
    );
    const lowSprite = lowCommands.find(
        (command) => command.image === image && !command.vertices
    );
    assert.equal(highSprite.w, lowSprite.w);
    assert.equal(highSprite.h, lowSprite.h);
    assert.ok(highSprite.y < lowSprite.y);

    const highShadow = highCommands.find(
        (command) => command.image === image && Array.isArray(command.vertices)
    );
    const lowShadow = lowCommands.find(
        (command) => command.image === image && Array.isArray(command.vertices)
    );
    assert.deepEqual(highShadow.vertices, lowShadow.vertices);
});

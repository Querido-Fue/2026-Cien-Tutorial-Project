import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TUTORIAL_ASSET_MANIFEST } from '../project/engine/script/data/game/tutorial_asset_manifest.js';
import { EFFECT_RENDER_CONSTANTS } from '../project/engine/script/data/display/effect_render_constants.js';
import { DarkTheme } from '../project/engine/script/data/theme/dark_theme.js';
import { LightTheme } from '../project/engine/script/data/theme/light_theme.js';
import { TutorialBattleHudView } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_hud_view.js';
import { TutorialBattleLayout } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_layout.js';
import { TutorialBattleTutorialView } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_tutorial_view.js';
import { TutorialBattleWorldView } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_world_view.js';
import { TUTORIAL_UI_LAYOUT_TOKENS } from '../project/engine/script/scene/tutorial/view/_tutorial_ui_layout_tokens.js';
import { TutorialBattleFocusController } from '../project/engine/script/scene/tutorial/_tutorial_battle_focus_controller.js';
import { TutorialCombatReadabilityPresenter } from '../project/engine/script/scene/tutorial/_tutorial_combat_readability_presenter.js';
import { TutorialGuidanceController } from '../project/engine/script/scene/tutorial/_tutorial_guidance_controller.js';
import { TUTORIAL_COMMANDS } from '../project/engine/script/scene/tutorial/_tutorial_scene_constants.js';

const VIEWPORTS = Object.freeze([
    Object.freeze({ name: '1280×720', WW: 1280, WH: 720, UIWW: 1280, UIOffsetX: 0 }),
    Object.freeze({ name: '1600×720', WW: 1600, WH: 720, UIWW: 1280, UIOffsetX: 160 }),
    Object.freeze({
        name: '최소 높이',
        WW: 1280,
        WH: 640,
        UIWW: 1137.7777777778,
        UIOffsetX: 71.1111111111
    })
]);

const NOOP_RENDER_PORT = Object.freeze({
    render() {},
    measureText(text) {
        return String(text).length * 10;
    },
    wrapText(text) {
        return [String(text)];
    }
});

/** @returns {TutorialBattleLayout} 실제 데이터와 같은 순수 레이아웃입니다. */
function createLayout() {
    return new TutorialBattleLayout({
        map: TUTORIAL_GAME_DATA.MAP,
        floors: TUTORIAL_GAME_DATA.FLOORS,
        mapArtwork: TUTORIAL_ASSET_MANIFEST.MAPS,
        camera: TUTORIAL_GAME_DATA.LAYOUT.CAMERA,
        board: TUTORIAL_GAME_DATA.LAYOUT.BOARD,
        hud: TUTORIAL_GAME_DATA.LAYOUT.HUD,
        shakeTileRatio: TUTORIAL_GAME_DATA.ANIMATION.SHAKE_TILE_RATIO
    });
}

/**
 * 두 사각형이 양의 면적으로 겹치는지 확인합니다.
 * @param {object} left - 첫 사각형입니다.
 * @param {object} right - 둘째 사각형입니다.
 * @returns {boolean} 겹침 여부입니다.
 */
function overlaps(left, right) {
    return left.x < right.x + right.w
        && left.x + left.w > right.x
        && left.y < right.y + right.h
        && left.y + left.h > right.y;
}

/**
 * 사각형이 UI 유효 영역에 포함되는지 확인합니다.
 * @param {object} rect - 검사할 사각형입니다.
 * @param {object} viewport - 검사할 화면입니다.
 * @returns {boolean} 포함 여부입니다.
 */
function isWithinUi(rect, viewport) {
    return rect.x >= viewport.UIOffsetX
        && rect.y >= 0
        && rect.x + rect.w <= viewport.UIOffsetX + viewport.UIWW
        && rect.y + rect.h <= viewport.WH;
}

test('타일 투영 중심은 같은 레이아웃의 히트테스트에서 원래 좌표로 돌아온다', () => {
    for (const viewport of VIEWPORTS) {
        const layout = createLayout();
        layout.resize(viewport);
        const frame = layout.createFrame({
            floor: TUTORIAL_GAME_DATA.FLOORS[0],
            elapsedSeconds: 0,
            screenShakeSeconds: 0
        });
        for (const tile of [{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 8, y: 7 }]) {
            const point = TutorialBattleLayout.projectTile(frame, tile.x, tile.y);
            assert.equal(Number.isFinite(point.x), true, viewport.name);
            assert.equal(Number.isFinite(point.y), true, viewport.name);
            assert.deepEqual(
                TutorialBattleLayout.hitTestTile(frame, point.x, point.y),
                tile,
                `${viewport.name} 투영과 히트테스트가 달라졌습니다.`
            );
        }
    }
});

test('맵은 실제 격자 좌우 폭을 월드 뷰포트에 맞추고 카메라 이동에도 HUD를 고정한다', () => {
    const layout = createLayout();
    layout.resize(VIEWPORTS[0]);
    const floor = TUTORIAL_GAME_DATA.FLOORS[0];
    const centered = layout.createFrame({
        floor,
        camera: { x: 4, y: 4, floorIndex: 0, initialized: true }
    });
    const moved = layout.createFrame({
        floor,
        camera: { x: 5, y: 4, floorIndex: 0, initialized: true }
    });
    const profile = TUTORIAL_ASSET_MANIFEST.MAPS['first-floor'];
    const quad = Object.values(profile.gridQuad);
    const sourceGridWidth = Math.max(...quad.map(({ x }) => x))
        - Math.min(...quad.map(({ x }) => x));
    const renderedGridWidth = sourceGridWidth
        * (centered.mapImageRect.w / profile.sourceDimensions.width);

    assert.ok(Math.abs(renderedGridWidth - centered.worldRect.w) <= 1.5);
    assert.equal(centered.mapImageRect.x <= centered.worldRect.x, true);
    assert.equal(
        centered.mapImageRect.x + centered.mapImageRect.w
            >= centered.worldRect.x + centered.worldRect.w,
        true
    );
    assert.equal(centered.mapImageRect.y <= centered.worldRect.y, true);
    assert.equal(
        centered.mapImageRect.y + centered.mapImageRect.h
            >= centered.worldRect.y + centered.worldRect.h,
        true
    );
    assert.equal(moved.mapImageRect.x < centered.mapImageRect.x, true);
    assert.deepEqual(moved.hudRects, centered.hudRects);
    const focused = TutorialBattleLayout.projectTile(moved, 5, 4);
    assert.ok(Math.abs(focused.x - (moved.worldRect.w * 0.5)) <= 1);
    assert.deepEqual(
        TutorialBattleLayout.hitTestTile(moved, focused.x, focused.y),
        { x: 5, y: 4 }
    );
});

test('촛대 화염은 원본 심지 10곳을 카메라와 함께 투영해 하나의 WebGL 명령으로 그린다', () => {
    const layoutController = createLayout();
    layoutController.resize(VIEWPORTS[0]);
    const sourceFloor = TUTORIAL_GAME_DATA.FLOORS[0];
    const centered = layoutController.createFrame({
        floor: sourceFloor,
        camera: { x: 4, y: 4, floorIndex: 0, initialized: true }
    });
    const moved = layoutController.createFrame({
        floor: sourceFloor,
        camera: { x: 5, y: 4, floorIndex: 0, initialized: true }
    });
    const profile = TUTORIAL_ASSET_MANIFEST.MAPS['first-floor'];
    const sourceEmitters = profile.ambientFire.emitters;
    const scaleX = centered.mapImageRect.w / profile.sourceDimensions.width;
    const scaleY = centered.mapImageRect.h / profile.sourceDimensions.height;

    assert.equal(centered.ambientFire.emitters.length, 10);
    centered.ambientFire.emitters.forEach((emitter, index) => {
        assert.equal(
            emitter.x,
            Math.round(centered.mapImageRect.x + (sourceEmitters[index].x * scaleX))
        );
        assert.equal(
            emitter.y,
            Math.round(centered.mapImageRect.y + (sourceEmitters[index].y * scaleY))
        );
        assert.ok(emitter.size > 1);
        assert.equal(Number.isInteger(emitter.x), true);
        assert.equal(Number.isInteger(emitter.y), true);
        assert.equal(
            moved.ambientFire.emitters[index].x - emitter.x,
            moved.mapImageRect.x - centered.mapImageRect.x
        );
    });
    const basement = layoutController.createFrame({
        floor: TUTORIAL_GAME_DATA.FLOORS[1]
    });
    assert.equal(basement.ambientFire, null);

    const floor = {
        ...sourceFloor,
        walls: [], items: [], records: [], eventTiles: [], teleports: [], mobs: []
    };
    const commands = [];
    const view = new TutorialBattleWorldView({
        render() {},
        renderGL(layer, command) {
            commands.push({ layer, ...command });
        },
        measureText(text) {
            return String(text).length * 8;
        }
    }, {
        getMapArtwork() {
            return { layers: [] };
        }
    });
    view.draw({
        snapshot: { phase: 'action', floorIndex: 0, player: null, lora: null },
        floor,
        layout: centered,
        fonts: { SMALL: '12px sans-serif', HEADING: '18px sans-serif' },
        colors: {
            BoardFrame: '#frame',
            Tile: {},
            UI: {},
            Effects: {
                FlameOuter: '#outer',
                FlameCore: '#core',
                FlameEmber: '#ember'
            }
        },
        world: {
            presentation: { floorIndex: 0, pathProgress: 1 },
            attackSelected: false,
            cleanseSelected: false,
            pathExtensions: [],
            plannedPath: [],
            hoveredTile: null,
            readability: { loraIntent: { ok: false } },
            floorActors: {},
            itemMetadata: {},
            elapsedSeconds: 3.25,
            config: {}
        }
    });
    assert.equal(commands.some((command) => command.fill === '#frame'), false);
    const flame = commands.find((command) => (
        command.effectType === EFFECT_RENDER_CONSTANTS.TYPES.FLAME_PARTICLES
    ));
    assert.ok(flame);
    assert.equal(flame.layer, 'effect');
    assert.equal(flame.emitters, centered.ambientFire.emitters);
    assert.equal(flame.time, 3.25);
    assert.equal(flame.alpha, profile.ambientFire.alpha);
    assert.deepEqual(
        [flame.outerColor, flame.coreColor, flame.emberColor],
        ['#outer', '#core', '#ember']
    );

    const fallbackCommands = [];
    const fallbackView = new TutorialBattleWorldView({
        render() {},
        renderGL(layer, command) {
            fallbackCommands.push({ layer, ...command });
        },
        measureText() {
            return 0;
        }
    }, {
        getMapArtwork() {
            return null;
        }
    });
    fallbackView.draw({
        snapshot: { phase: 'action', floorIndex: 0, player: null, lora: null },
        floor,
        layout: centered,
        fonts: { SMALL: '12px sans-serif', HEADING: '18px sans-serif' },
        colors: { BoardFrame: '#frame', Tile: {}, UI: {}, Effects: {} },
        world: {
            presentation: { floorIndex: 0, pathProgress: 1 },
            attackSelected: false,
            cleanseSelected: false,
            pathExtensions: [],
            plannedPath: [],
            hoveredTile: null,
            readability: { loraIntent: { ok: false } },
            floorActors: {},
            itemMetadata: {},
            elapsedSeconds: 3.25,
            config: {}
        }
    });
    assert.equal(fallbackCommands.some((command) => (
        command.effectType === EFFECT_RENDER_CONSTANTS.TYPES.FLAME_PARTICLES
    )), false);
    assert.equal(fallbackCommands.some((command) => (
        command.fill === '#frame'
    )), true);
});

test('두 테마와 브라우저 바깥 배경은 단일 #101010 색상을 사용한다', async () => {
    for (const theme of [LightTheme, DarkTheme]) {
        assert.equal(theme.Background, '#101010');
        assert.equal(theme.Tactics.WorldBackdrop, '#101010');
        assert.match(theme.Tactics.Effects.FlameOuter, /^#/);
        assert.match(theme.Tactics.Effects.FlameCore, /^#/);
        assert.match(theme.Tactics.Effects.FlameEmber, /^#/);
    }
    const css = await readFile(new URL('../project/engine/style.css', import.meta.url), 'utf8');
    assert.match(css, /body\s*\{[\s\S]*?background-color:\s*#101010;/);
    assert.match(css, /html\s*\{[\s\S]*?background-color:\s*#101010;/);
    assert.doesNotMatch(css, /#202020/i);
});

test('이동 미리보기는 맵 타일의 두 투영 축으로 계산한 네 꼭짓점을 그린다', () => {
    const layoutController = createLayout();
    layoutController.resize(VIEWPORTS[0]);
    const floor = {
        ...TUTORIAL_GAME_DATA.FLOORS[0],
        walls: [],
        items: [],
        eventTiles: [],
        teleports: [],
        mobs: []
    };
    const layout = layoutController.createFrame({
        floor,
        elapsedSeconds: 0,
        screenShakeSeconds: 0
    });
    const commands = [];
    const view = new TutorialBattleWorldView({
        render() {},
        renderGL(layer, command) {
            commands.push({ layer, ...command });
        },
        measureText(text) {
            return String(text).length * 8;
        }
    }, {
        getMapArtwork() {
            return { layers: [] };
        }
    });
    view.draw({
        snapshot: { phase: 'move', floorIndex: 0, player: null, lora: null },
        floor,
        layout,
        fonts: { SMALL: '12px sans-serif', HEADING: '18px sans-serif' },
        colors: {
            BoardFrame: '#frame',
            Tile: { Reachable: '#reachable', Teleport: '#teleport' },
            UI: {}
        },
        world: {
            presentation: { floorIndex: 0, pathProgress: 1 },
            attackSelected: false,
            cleanseSelected: false,
            pathExtensions: [[{ x: 4, y: 4 }]],
            plannedPath: [],
            hoveredTile: null,
            readability: { loraIntent: { ok: false } },
            floorActors: {},
            itemMetadata: {},
            elapsedSeconds: 0,
            config: {}
        }
    });

    const preview = commands.find((command) => command.fill === '#reachable');
    const expectedVertices = TutorialBattleLayout.projectTileQuad(layout, 4, 4, 0.76);
    assert.equal(preview.shape, 'rect');
    assert.deepEqual(preview.vertices, expectedVertices);
    assert.notEqual(preview.vertices[1], preview.vertices[3]);
    assert.notEqual(preview.vertices[0], preview.vertices[4]);
});

test('1층 양 끝 텔레포트는 장식 테두리가 아닌 실제 타일 중심에 놓인다', () => {
    const layoutController = createLayout();
    layoutController.resize(VIEWPORTS[0]);
    const floor = {
        ...TUTORIAL_GAME_DATA.FLOORS[0],
        walls: [],
        items: [],
        eventTiles: [],
        mobs: []
    };
    const layout = layoutController.createFrame({
        floor,
        elapsedSeconds: 0,
        screenShakeSeconds: 0
    });
    const marker = { width: 59, height: 32 };
    const commands = [];
    const view = new TutorialBattleWorldView({
        render(layer, command) {
            commands.push({ layer, ...command });
        },
        renderGL(layer, command) {
            commands.push({ layer, ...command });
        },
        measureText(text) {
            return String(text).length * 8;
        }
    }, {
        getMapArtwork() {
            return { layers: [] };
        },
        getUiAsset(key) {
            return key === 'teleportMarker' ? marker : null;
        }
    });
    view.draw({
        snapshot: { phase: 'move', floorIndex: 0, player: null, lora: null },
        floor,
        layout,
        fonts: { SMALL: '12px sans-serif', HEADING: '18px sans-serif' },
        colors: {
            BoardFrame: '#frame',
            Entity: {},
            Tile: {},
            UI: {}
        },
        world: {
            presentation: { floorIndex: 0, pathProgress: 1 },
            attackSelected: false,
            cleanseSelected: false,
            pathExtensions: [],
            plannedPath: [],
            hoveredTile: null,
            readability: { loraIntent: { ok: false } },
            floorActors: {},
            itemMetadata: {},
            elapsedSeconds: 0,
            config: {}
        }
    });

    const profile = TUTORIAL_ASSET_MANIFEST.MAPS['first-floor'];
    const scaleX = layout.mapImageRect.w / profile.sourceDimensions.width;
    const scaleY = layout.mapImageRect.h / profile.sourceDimensions.height;
    const expectedSourceCenters = [
        { x: 471, y: 160 },
        { x: 577, y: 516 }
    ];
    const markerCommands = commands.filter((command) => command.image === marker);
    assert.equal(markerCommands.length, 2);
    floor.teleports.forEach((teleport, index) => {
        const point = TutorialBattleLayout.projectTile(
            layout,
            teleport.x,
            teleport.y
        );
        const expected = expectedSourceCenters[index];
        assert.ok(Math.abs(
            point.x - (layout.mapImageRect.x + (expected.x * scaleX))
        ) < 0.001, `${teleport.id}의 X 중심이 실제 격자와 다릅니다.`);
        assert.ok(Math.abs(
            point.y - (layout.mapImageRect.y + (expected.y * scaleY))
        ) < 0.001, `${teleport.id}의 Y 중심이 실제 격자와 다릅니다.`);
        assert.ok(Math.abs(
            markerCommands[index].x + (markerCommands[index].w * 0.5) - point.x
        ) <= 0.75, `${teleport.id} 마법진의 X 중심이 타일과 다릅니다.`);
        assert.ok(Math.abs(
            markerCommands[index].y + (markerCommands[index].h * 0.5) - point.y
        ) <= 0.75, `${teleport.id} 마법진의 Y 중심이 타일과 다릅니다.`);
    });
});

test('연결된 벽은 공통 변을 빼고 실제 타일 외곽에 낮은 석조벽·가시 울타리를 그린다', () => {
    const layoutController = createLayout();
    layoutController.resize(VIEWPORTS[0]);
    const floor = {
        ...TUTORIAL_GAME_DATA.FLOORS[0],
        walls: [
            { id: 'wall-test-a', x: 4, y: 4, destroyed: false },
            { id: 'wall-test-b', x: 5, y: 4, destroyed: false }
        ],
        items: [],
        eventTiles: [],
        teleports: [],
        mobs: []
    };
    const layout = layoutController.createFrame({
        floor,
        elapsedSeconds: 0,
        screenShakeSeconds: 0
    });
    const wallBarrier = { width: 1450, height: 450 };
    const commands = [];
    const view = new TutorialBattleWorldView({
        render(layer, command) {
            commands.push({ layer, ...command });
        },
        renderGL(layer, command) {
            commands.push({ layer, ...command });
        },
        measureText(text) {
            return String(text).length * 8;
        }
    }, {
        getMapArtwork() {
            return { layers: [] };
        },
        getUiAsset(key) {
            return key === 'wallBarrier' ? wallBarrier : null;
        }
    });
    view.draw({
        snapshot: { phase: 'move', floorIndex: 0, player: null, lora: null },
        floor,
        layout,
        fonts: { SMALL: '12px sans-serif', HEADING: '18px sans-serif' },
        colors: {
            BoardFrame: '#frame',
            Tile: { Reachable: '#reachable', Teleport: '#teleport' },
            UI: {}
        },
        world: {
            presentation: { floorIndex: 0, pathProgress: 1 },
            attackSelected: false,
            cleanseSelected: false,
            pathExtensions: [],
            plannedPath: [],
            hoveredTile: null,
            readability: { loraIntent: { ok: false } },
            floorActors: {},
            itemMetadata: {},
            elapsedSeconds: 0,
            config: {}
        }
    });

    const barriers = commands.filter((command) => command.image === wallBarrier);
    assert.equal(barriers.length, 6);
    assert.equal(barriers.every((command) => command.layer === 'object'), true);
    assert.equal(barriers.every((command) => command.smoothing === false), true);
    assert.equal(barriers.every((command) => command.vertices.length === 8), true);
    assert.equal(barriers.every((command) => (
        command.vertices[5] - command.vertices[3]
            <= (layout.tileHeight * 0.34) + 0.000001
        && command.vertices[7] - command.vertices[1]
            <= (layout.tileHeight * 0.34) + 0.000001
    )), true);

    const edgeKey = (left, right) => [left, right]
        .map((point) => point.map((value) => value.toFixed(6)).join(','))
        .sort()
        .join('|');
    const projectedCorners = (x, y) => {
        const projected = TutorialBattleLayout.projectTileQuad(layout, x, y, 1);
        return Array.from({ length: 4 }, (_, index) => [
            projected[index * 2],
            projected[(index * 2) + 1]
        ]);
    };
    const firstCorners = projectedCorners(4, 4);
    const secondCorners = projectedCorners(5, 4);
    const expectedEdges = new Set([
        edgeKey(firstCorners[0], firstCorners[1]),
        edgeKey(firstCorners[0], firstCorners[3]),
        edgeKey(firstCorners[3], firstCorners[2]),
        edgeKey(secondCorners[0], secondCorners[1]),
        edgeKey(secondCorners[1], secondCorners[2]),
        edgeKey(secondCorners[3], secondCorners[2])
    ]);
    const actualEdges = new Set(barriers.map((command) => edgeKey(
        [command.vertices[4], command.vertices[5]],
        [command.vertices[6], command.vertices[7]]
    )));
    assert.deepEqual(actualEdges, expectedEdges);
    assert.equal(commands.some((command) => command.text === '벽'), false);
});

test('월드 아이템은 절반 크기와 아이템별 시각 중심, 은은한 후광을 사용한다', () => {
    const layoutController = createLayout();
    layoutController.resize(VIEWPORTS[0]);
    const floor = {
        ...TUTORIAL_GAME_DATA.FLOORS[0],
        walls: [],
        items: [{
            id: 'item-test', itemId: 'diamond-pickaxe', x: 4, y: 4,
            collected: false, identified: true
        }],
        eventTiles: [],
        teleports: [],
        mobs: []
    };
    const layout = layoutController.createFrame({
        floor,
        elapsedSeconds: 0,
        screenShakeSeconds: 0
    });
    const itemIcon = { width: 16, height: 16 };
    const commands = [];
    const view = new TutorialBattleWorldView({
        render(layer, command) {
            commands.push({ layer, ...command });
        },
        renderGL(layer, command) {
            commands.push({ layer, ...command });
        },
        measureText(text) {
            return String(text).length * 8;
        }
    }, {
        getMapArtwork() {
            return { layers: [] };
        },
        getItemIcon(itemId) {
            return itemId === 'diamond-pickaxe' ? itemIcon : null;
        }
    });
    view.draw({
        snapshot: { phase: 'move', floorIndex: 0, player: null, lora: null },
        floor,
        layout,
        fonts: { SMALL: '12px sans-serif', HEADING: '18px sans-serif' },
        colors: {
            BoardFrame: '#frame',
            Entity: { Item: '#item-halo' },
            Tile: { Item: '#item' },
            UI: { Text: '#text' }
        },
        world: {
            presentation: { floorIndex: 0, pathProgress: 1 },
            attackSelected: false,
            cleanseSelected: false,
            pathExtensions: [],
            plannedPath: [],
            hoveredTile: null,
            readability: { loraIntent: { ok: false } },
            floorActors: {},
            itemMetadata: { 'diamond-pickaxe': {} },
            elapsedSeconds: 0,
            config: { itemIcon: TUTORIAL_GAME_DATA.SPRITES.ITEM }
        }
    });

    const point = TutorialBattleLayout.projectTile(layout, 4, 4);
    const itemLayout = TUTORIAL_GAME_DATA.SPRITES.ITEM;
    const halo = commands.find((command) => command.fill === '#item-halo');
    const icon = commands.find((command) => command.image === itemIcon);
    const iconSize = layout.tileSide * itemLayout.WORLD_ICON_SIZE_TILE_RATIO;
    const visualCenter = itemLayout.VISUAL_CENTERS['diamond-pickaxe'];
    const bitmapItemIds = Object.keys(TUTORIAL_ASSET_MANIFEST.ITEMS)
        .filter((itemId) => itemId !== 'tile-cleanser')
        .sort();
    assert.deepEqual(Object.keys(itemLayout.VISUAL_CENTERS).sort(), bitmapItemIds);
    assert.deepEqual(visualCenter, { x: 0.5, y: 0.5 });
    assert.equal(itemLayout.WORLD_ICON_SIZE_TILE_RATIO, 0.64 * 0.5);
    assert.equal(itemLayout.WORLD_HALO_SIZE_TILE_RATIO, 0.36);
    assert.equal(halo.alpha, 0.24);
    assert.equal(halo.w, layout.tileSide * itemLayout.WORLD_HALO_SIZE_TILE_RATIO);
    assert.equal(halo.h, layout.tileSide * itemLayout.WORLD_HALO_SIZE_TILE_RATIO);
    assert.deepEqual(
        { x: icon.x, y: icon.y, w: icon.w, h: icon.h, smoothing: icon.smoothing },
        {
            x: Math.round(point.x - (iconSize * visualCenter.x)),
            y: Math.round(point.y - (iconSize * visualCenter.y)),
            w: Math.round(iconSize),
            h: Math.round(iconSize),
            smoothing: false
        }
    );
});

test('세 화면비에서 HUD 영역은 UI 안에 있고 서로 겹치지 않는다', () => {
    for (const viewport of VIEWPORTS) {
        const layout = createLayout();
        const geometry = layout.resize(viewport);
        const entries = Object.entries(geometry.hudRects);
        for (const [name, rect] of entries) {
            assert.equal(
                isWithinUi(rect, viewport),
                true,
                `${viewport.name} ${name}이 UI 영역 밖입니다.`
            );
        }
        for (let leftIndex = 0; leftIndex < entries.length; leftIndex++) {
            for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex++) {
                const [leftName, left] = entries[leftIndex];
                const [rightName, right] = entries[rightIndex];
                assert.equal(
                    overlaps(left, right),
                    false,
                    `${viewport.name} ${leftName}과 ${rightName}이 겹칩니다.`
                );
            }
        }
        assert.equal(isWithinUi(geometry.boardRect, viewport), true, viewport.name);
    }
});

test('1280×720 전투 레이아웃은 Figma 정규화 앵커를 그대로 투영한다', () => {
    const geometry = createLayout().resize(VIEWPORTS[0]);
    const mappings = {
        boardRect: TUTORIAL_UI_LAYOUT_TOKENS.BATTLE.MAP,
        STAGE_HEADER: TUTORIAL_UI_LAYOUT_TOKENS.BATTLE.TURN,
        LORA_CARD: TUTORIAL_UI_LAYOUT_TOKENS.BATTLE.LORA,
        PLAYER_STATUS: TUTORIAL_UI_LAYOUT_TOKENS.BATTLE.PLAYER,
        PRIMARY_ACTION: TUTORIAL_UI_LAYOUT_TOKENS.BATTLE.ACTION,
        SECONDARY_ACTIONS: TUTORIAL_UI_LAYOUT_TOKENS.BATTLE.SECONDARY,
        INVENTORY_CARD: TUTORIAL_UI_LAYOUT_TOKENS.BATTLE.ITEM_FOCUS
    };
    for (const [key, token] of Object.entries(mappings)) {
        const actual = key === 'boardRect' ? geometry.boardRect : geometry.hudRects[key];
        assert.deepEqual(actual, {
            x: Math.round(token.x * 1280),
            y: Math.round(token.y * 720),
            w: Math.round(token.w * 1280),
            h: Math.round(token.h * 720)
        }, key);
    }
});

test('인벤토리 페이지는 음수와 초과 요청을 유효 범위로 제한한다', () => {
    const view = new TutorialBattleHudView(NOOP_RENDER_PORT);
    const entries = Array.from({ length: 32 }, (_, index) => ({
        itemId: 'item-' + String(index),
        count: 1
    }));
    const first = view.getInventoryPaging(entries, -10, 15);
    const last = view.getInventoryPaging(entries, 99, 15);
    assert.equal(first.page, 0);
    assert.equal(first.pageCount, 3);
    assert.equal(first.entries.length, 15);
    assert.equal(last.page, 2);
    assert.equal(last.entries.length, 2);
});

test('이동 경로 초기화 버튼은 한 칸 이상 선택한 이동 단계에서만 활성화된다', () => {
    const view = new TutorialBattleHudView(NOOP_RENDER_PORT);
    const layout = createLayout().resize(VIEWPORTS[0]);
    const createViewModel = (stepsUsed) => ({
        snapshot: { phase: 'move', actionUsed: false },
        layout,
        colors: {
            UI: {
                Primary: '#a00', PrimaryHover: '#b00', OnPrimary: '#fff',
                Card: '#fff', ButtonHover: '#ddd', Text: '#111',
                ButtonShadow: '#000', CardShadow: '#000'
            }
        },
        hud: {
            attackSelected: false,
            attackWeapon: 'melee',
            focusedControlKey: null,
            presentationLocked: false,
            movePreview: { ok: true, stepsUsed },
            controls: {
                ready: true,
                actionReady: false,
                meleeTargetCount: 0,
                bowTargetCount: 0,
                hasBow: false
            },
            inventory: { entries: [], pageCount: 1 },
            config: {
                actions: TUTORIAL_GAME_DATA.LAYOUT.ACTIONS,
                inventory: TUTORIAL_GAME_DATA.LAYOUT.INVENTORY,
                itemIcon: TUTORIAL_GAME_DATA.SPRITES.ITEM
            }
        }
    });
    const inactive = view.getButtonSpecs(createViewModel(0))
        .find((spec) => spec.key === 'battle-reset-path');
    const active = view.getButtonSpecs(createViewModel(2))
        .find((spec) => spec.key === 'battle-reset-path');

    assert.equal(inactive.enabled, false);
    assert.equal(active.enabled, true);
    assert.equal(active.tooltip, '이동 초기화');
    assert.deepEqual(active.command, { type: TUTORIAL_COMMANDS.PLAN_RESET, payload: undefined });
    const moveConfirm = view.getButtonSpecs(createViewModel(2))
        .find((spec) => spec.key === 'battle-end');
    assert.equal(moveConfirm.tooltip, '2칸 이동 확정');
    assert.equal(
        view.getButtonSpecs(createViewModel(2))
            .some((spec) => [
                'battle-melee', 'battle-ranged', 'battle-heal', 'battle-idle'
            ].includes(spec.key)),
        false
    );
});

test('이동 확정 뒤 우하단 행동 메뉴는 확대된 공격과 60% 회복·대기 버튼으로 교체된다', () => {
    const commands = [];
    const assets = {
        actionButton: { naturalWidth: 135, naturalHeight: 96 },
        waitHealButton: { naturalWidth: 40, naturalHeight: 40 },
        attackIcon: { naturalWidth: 1038, naturalHeight: 1104 },
        resetIcon: { naturalWidth: 994, naturalHeight: 1004 },
        healIcon: { naturalWidth: 12, naturalHeight: 12 },
        waitIcon: { naturalWidth: 12, naturalHeight: 14 }
    };
    const renderPort = {
        render(layer, command) {
            commands.push({ layer, ...command });
        },
        measureText(text) {
            return String(text).length * 8;
        },
        wrapText(text) {
            return [String(text)];
        }
    };
    const layout = createLayout().resize(VIEWPORTS[0]);
    const viewModel = {
        snapshot: {
            phase: 'action', actionUsed: false, loraActionsCompleted: 0,
            maxTurns: 12, player: { maxHp: 100 }, lora: { maxHp: 100 }
        },
        layout,
        colors: {
            UI: {
                OnPrimary: '#fff', Text: '#eee', Border: '#333',
                GaugeHp: '#hp', GaugeInstability: '#instability',
                Success: '#0a0', Danger: '#d00'
            }
        },
        fonts: { BUTTON: '18px LanaPixel', SMALL: '14px LanaPixel' },
        world: {
            presentation: { playerHp: 100, loraHp: 100, instability: 70 },
            elapsedSeconds: 3
        },
        hud: {
            attackSelected: false,
            attackWeapon: 'melee',
            focusedControlKey: null,
            movePreview: { ok: true, stepsUsed: 0 },
            readability: { playerPreview: null, inspectedItem: null },
            controls: {
                ready: true,
                actionReady: true,
                meleeTargetCount: 1,
                bowTargetCount: 1,
                hasBow: true,
                preferredAttackWeapon: 'bow'
            },
            inventory: { entries: [], page: 0, pageCount: 1 },
            config: {
                actions: TUTORIAL_GAME_DATA.LAYOUT.ACTIONS,
                inventory: TUTORIAL_GAME_DATA.LAYOUT.INVENTORY,
                itemIcon: TUTORIAL_GAME_DATA.SPRITES.ITEM,
                floorTransitionAfterTurn: 6
            }
        }
    };
    const view = new TutorialBattleHudView(renderPort, {
        getUiAsset(key) {
            return assets[key] || null;
        }
    });
    const actionSpecs = view.getButtonSpecs(viewModel)
        .filter((spec) => spec.key.startsWith('battle-'));

    assert.deepEqual(
        actionSpecs.map((spec) => spec.key),
        ['battle-ranged', 'battle-heal', 'battle-idle']
    );
    assert.equal(actionSpecs.every((spec) => spec.label === ''), true);
    assert.equal(actionSpecs.every((spec) => spec.drawBackground === false), true);
    for (let leftIndex = 0; leftIndex < actionSpecs.length; leftIndex++) {
        for (let rightIndex = leftIndex + 1; rightIndex < actionSpecs.length; rightIndex++) {
            assert.equal(
                overlaps(actionSpecs[leftIndex], actionSpecs[rightIndex]),
                false,
                `${actionSpecs[leftIndex].key}와 ${actionSpecs[rightIndex].key}의 히트 영역이 겹칩니다.`
            );
        }
    }
    const heal = actionSpecs.find((spec) => spec.key === 'battle-heal');
    const idle = actionSpecs.find((spec) => spec.key === 'battle-idle');
    const primary = actionSpecs.find((spec) => spec.key === 'battle-ranged');
    assert.equal(heal.x + heal.w < primary.x, true);
    assert.equal(primary.x + primary.w < idle.x, true);
    assert.ok(Math.abs((heal.h / primary.h) - 0.6) < 0.02);
    assert.ok(Math.abs((idle.h / primary.h) - 0.6) < 0.02);
    assert.deepEqual(primary.command, {
        type: TUTORIAL_COMMANDS.SELECT_ATTACK,
        payload: { weapon: 'bow' }
    });
    assert.equal(actionSpecs.some((spec) => spec.key === 'battle-reset-path'), false);
    assert.equal(actionSpecs.some((spec) => spec.key === 'battle-end'), false);

    view.draw(viewModel);
    assert.equal(commands.filter((command) => command.image === assets.actionButton).length, 1);
    assert.equal(commands.filter((command) => command.image === assets.waitHealButton).length, 2);
    assert.equal(commands.filter((command) => command.image === assets.attackIcon).length, 1);
    assert.equal(commands.filter((command) => command.image === assets.healIcon).length, 1);
    assert.equal(commands.filter((command) => command.image === assets.waitIcon).length, 1);
    assert.equal(commands.filter((command) => command.text === '공격').length, 1);
    assert.equal(commands.some((command) => (
        ['근접', '원거리', '회복', '대기', '액션'].includes(command.text)
    )), false);
});

test('우하단 커맨드 전환은 90% 플립 뒤 보조 버튼을 펼치고 역순에서는 먼저 접는다', () => {
    const commands = [];
    const assets = {
        actionButton: { naturalWidth: 135, naturalHeight: 96 },
        waitHealButton: { naturalWidth: 40, naturalHeight: 40 },
        attackIcon: { naturalWidth: 1038, naturalHeight: 1104 },
        resetIcon: { naturalWidth: 994, naturalHeight: 1004 },
        healIcon: { naturalWidth: 12, naturalHeight: 12 },
        waitIcon: { naturalWidth: 12, naturalHeight: 14 }
    };
    const renderPort = {
        render(layer, command) {
            commands.push({ layer, ...command });
        },
        measureText(text) {
            return String(text).length * 8;
        },
        wrapText(text) {
            return [String(text)];
        }
    };
    const layout = createLayout().resize(VIEWPORTS[0]);
    const viewModel = {
        snapshot: { phase: 'move', actionUsed: false },
        layout,
        colors: { UI: { OnPrimary: '#fff', Text: '#eee' } },
        fonts: { BUTTON: '18px LanaPixel', SMALL: '14px LanaPixel' },
        world: {
            elapsedSeconds: 0,
            presentation: { playerHp: 100, loraHp: 100, instability: 70 }
        },
        hud: {
            attackSelected: false,
            attackWeapon: 'melee',
            focusedControlKey: null,
            movePreview: { ok: true, stepsUsed: 2 },
            readability: { playerPreview: null, inspectedItem: null },
            controls: {
                ready: true,
                actionReady: false,
                meleeTargetCount: 1,
                bowTargetCount: 0,
                hasBow: false,
                preferredAttackWeapon: 'melee'
            },
            inventory: { entries: [], page: 0, pageCount: 1 },
            config: {
                actions: TUTORIAL_GAME_DATA.LAYOUT.ACTIONS,
                inventory: TUTORIAL_GAME_DATA.LAYOUT.INVENTORY,
                itemIcon: TUTORIAL_GAME_DATA.SPRITES.ITEM
            }
        }
    };
    const view = new TutorialBattleHudView(renderPort, {
        getUiAsset(key) {
            return assets[key] || null;
        }
    });

    view.draw(viewModel);
    assert.equal(commands.some((command) => command.text === '2칸 이동 확정'), true);
    assert.equal(commands.some((command) => command.image === assets.resetIcon), true);
    assert.equal(commands.some((command) => command.image === assets.healIcon), false);

    viewModel.snapshot.phase = 'action';
    viewModel.hud.controls.actionReady = true;
    commands.length = 0;
    viewModel.world.elapsedSeconds = 0;
    view.draw(viewModel);

    commands.length = 0;
    viewModel.world.elapsedSeconds = 0.44;
    view.draw(viewModel);
    assert.equal(commands.some((command) => command.image === assets.healIcon), false);

    commands.length = 0;
    viewModel.world.elapsedSeconds = 0.46;
    view.draw(viewModel);
    assert.equal(commands.some((command) => command.image === assets.healIcon), true);

    commands.length = 0;
    viewModel.world.elapsedSeconds = 0.72;
    view.draw(viewModel);
    assert.equal(commands.some((command) => command.image === assets.attackIcon), true);
    assert.equal(commands.some((command) => command.image === assets.resetIcon), false);

    viewModel.snapshot.phase = 'move';
    viewModel.hud.controls.actionReady = false;
    commands.length = 0;
    viewModel.world.elapsedSeconds = 0.72;
    view.draw(viewModel);

    commands.length = 0;
    viewModel.world.elapsedSeconds = 0.85;
    view.draw(viewModel);
    const retreatingHeal = commands.find((command) => command.image === assets.healIcon);
    assert.ok(retreatingHeal);
    assert.equal(retreatingHeal.alpha < 0.92, true);

    commands.length = 0;
    viewModel.world.elapsedSeconds = 1.12;
    view.draw(viewModel);
    assert.equal(commands.some((command) => command.image === assets.healIcon), false);
});

test('로라·플레이어 상태와 아이템 설명은 원본 패널 내부에 맞춰진다', () => {
    const commands = [];
    const wrapRequests = [];
    const descriptionLines = ['받는 피해를', '줄여줍니다.'];
    const assets = {
        turnFrame: { naturalWidth: 177, naturalHeight: 29 },
        turnBefore: { naturalWidth: 15, naturalHeight: 15 },
        turnDuring: { naturalWidth: 15, naturalHeight: 15 },
        turnPassed: { naturalWidth: 15, naturalHeight: 15 },
        loraPanelFull: { naturalWidth: 247, naturalHeight: 90 },
        loraPortraitIcon: { naturalWidth: 1254, naturalHeight: 1254 },
        loraHpBar: { naturalWidth: 80, naturalHeight: 4 },
        loraGaugeBar: { naturalWidth: 80, naturalHeight: 4 },
        playerPanel: { naturalWidth: 232, naturalHeight: 78 },
        playerItemSelected: { naturalWidth: 32, naturalHeight: 32 },
        itemPanel: { naturalWidth: 86, naturalHeight: 128 }
    };
    const renderPort = {
        render(layer, command) {
            commands.push({ layer, ...command });
        },
        measureText(text) {
            return String(text).length * 8;
        },
        wrapText(text, font, maxWidth, maxLines) {
            wrapRequests.push({ text, font, maxWidth, maxLines });
            return descriptionLines;
        }
    };
    const inventoryItemIds = [
        'bow', 'mascot-costume', 'old-teddy', 'music-box', 'ocarina'
    ];
    const entries = inventoryItemIds.map((itemId, index) => ({
        itemId,
        count: 1,
        known: true,
        hasIcon: true,
        usable: index === 0,
        movementConsumable: false,
        statusLabel: '사용 가능',
        label: '아이템 ' + String(index + 1),
        description: '테스트 아이템'
    }));
    const layout = createLayout().resize(VIEWPORTS[0]);
    const viewModel = {
        snapshot: {
            phase: 'move',
            actionUsed: false,
            loraActionsCompleted: 0,
            maxTurns: 12,
            player: { maxHp: 100 },
            lora: { maxHp: 100 }
        },
        layout,
        colors: {
            UI: {
                Primary: '#a00', PrimaryHover: '#b00', OnPrimary: '#fff',
                Card: '#fff', CardHeader: '#ddd', ButtonHover: '#ccc',
                Text: '#111', Muted: '#777', Border: '#333', Success: '#0a0',
                Warning: '#fa0', Danger: '#d00', GaugeTrack: '#222',
                GaugeHp: '#hp', GaugeInstability: '#instability',
                ButtonShadow: '#000', CardShadow: '#000'
            }
        },
        fonts: {
            TITLE: '24px sans-serif',
            HEADING: '18px sans-serif',
            SMALL: '12px sans-serif',
            MONO: '12px monospace'
        },
        world: {
            presentation: { playerHp: 50, loraHp: 100, instability: 70 }
        },
        hud: {
            attackSelected: false,
            attackWeapon: 'melee',
            cleanseSelected: false,
            focusedControlKey: 'item-item-0',
            movePreview: { ok: true, stepsUsed: 0 },
            instabilityState: { label: '불안정' },
            readability: {
                playerPreview: null,
                inspectedItem: {
                    label: '인형탈',
                    count: 1,
                    statusLabel: '사용 가능',
                    description: '받는 피해를 줄여줍니다.'
                }
            },
            controls: {
                ready: true,
                actionReady: false,
                meleeTargetCount: 0,
                bowTargetCount: 0,
                hasBow: false
            },
            inventory: { entries, page: 0, pageCount: 1 },
            config: {
                actions: TUTORIAL_GAME_DATA.LAYOUT.ACTIONS,
                inventory: TUTORIAL_GAME_DATA.LAYOUT.INVENTORY,
                itemIcon: TUTORIAL_GAME_DATA.SPRITES.ITEM,
                floorTransitionAfterTurn: 6
            }
        }
    };
    const view = new TutorialBattleHudView(renderPort, {
        getUiAsset(key) {
            return assets[key] || null;
        }
    });

    const itemSpecs = view.getButtonSpecs(viewModel)
        .filter((spec) => spec.key.startsWith('item-'));
    assert.equal(TUTORIAL_GAME_DATA.LAYOUT.INVENTORY.PAGE_SIZE, 5);
    assert.equal(itemSpecs.length, 5);
    assert.deepEqual(
        { x: itemSpecs[0].x, y: itemSpecs[0].y, w: itemSpecs[0].w, h: itemSpecs[0].h },
        { x: 111, y: 599, w: 38, h: 38 }
    );
    assert.deepEqual(
        { x: itemSpecs[4].x, y: itemSpecs[4].y, w: itemSpecs[4].w, h: itemSpecs[4].h },
        { x: 262, y: 599, w: 38, h: 38 }
    );
    assert.equal(itemSpecs.every((spec) => spec.label === ''), true);
    assert.equal(itemSpecs.every((spec) => spec.drawBackground === false), true);
    assert.equal(itemSpecs.every((spec) => spec.itemSpacing === 0), true);
    assert.equal(itemSpecs.every((spec) => spec.tooltip == null), true);
    assert.deepEqual(
        itemSpecs[0].iconVisualCenter,
        TUTORIAL_GAME_DATA.SPRITES.ITEM.VISUAL_CENTERS.bow
    );
    assert.equal(itemSpecs[0].iconVisualCenter.x < 0.5, true);

    view.draw(viewModel);
    const loraPanelLayers = commands.filter(
        (command) => command.image === assets.loraPanelFull
    );
    const loraPanel = loraPanelLayers[0];
    const loraPortrait = commands.find(
        (command) => command.image === assets.loraPortraitIcon
    );
    const loraHpGauge = commands.find((command) => command.image === assets.loraHpBar);
    const instabilityGauge = commands.find(
        (command) => command.image === assets.loraGaugeBar
    );
    const playerPanel = commands.find((command) => command.image === assets.playerPanel);
    const occupiedSlots = commands.filter(
        (command) => command.image === assets.playerItemSelected
    );
    const itemPanel = commands.find((command) => command.image === assets.itemPanel);
    const playerGauge = commands.find(
        (command) => command.fill === '#hp' && command.x === 123 && command.y === 650
    );
    assert.deepEqual(
        { x: loraPanel.x, y: loraPanel.y, w: loraPanel.w, h: loraPanel.h },
        { x: 915, y: 42, w: 291, h: 106 }
    );
    assert.deepEqual(
        {
            x: loraPortrait.x,
            y: loraPortrait.y,
            w: loraPortrait.w,
            h: loraPortrait.h,
            clipVertices: loraPortrait.clipVertices,
            smoothing: loraPortrait.smoothing
        },
        {
            x: 904,
            y: 43,
            w: 79,
            h: 81,
            clipVertices: [944, 49, 973, 74, 944, 101, 922, 74],
            smoothing: false
        }
    );
    assert.equal(loraPanelLayers.length, 5);
    assert.equal(commands.indexOf(loraPanel) < commands.indexOf(loraPortrait), true);
    assert.equal(
        loraPanelLayers.slice(1).every((layer) => (
            commands.indexOf(layer) > commands.indexOf(loraPortrait)
            && Array.isArray(layer.clipVertices)
            && layer.smoothing === false
        )),
        true
    );
    assert.deepEqual(
        { x: loraHpGauge.x, y: loraHpGauge.y, w: loraHpGauge.w, h: loraHpGauge.h },
        { x: 988, y: 108, w: 176, h: 5 }
    );
    assert.deepEqual(
        {
            x: instabilityGauge.x,
            y: instabilityGauge.y,
            w: instabilityGauge.w,
            h: instabilityGauge.h
        },
        { x: 975, y: 124, w: 123, h: 5 }
    );
    assert.equal(
        commands.some((command) => typeof command.text === 'string'
            && /^(로라|HP|불안정)/.test(command.text)),
        false
    );
    assert.equal(
        commands.some((command) => [
            assets.turnFrame,
            assets.turnBefore,
            assets.turnDuring,
            assets.turnPassed
        ].includes(command.image)),
        false
    );
    assert.deepEqual(
        {
            x: itemPanel.x,
            y: itemPanel.y,
            w: itemPanel.w,
            h: itemPanel.h,
            alpha: itemPanel.alpha,
            smoothing: itemPanel.smoothing
        },
        { x: 46, y: 383, w: 134, h: 199, alpha: 1, smoothing: false }
    );
    const inventoryRect = layout.hudRects.INVENTORY_CARD;
    assert.equal(
        commands.some((command) => command.shape === 'roundRect'
            && command.w === inventoryRect.w && command.h === inventoryRect.h),
        false
    );
    assert.deepEqual(wrapRequests, [{
        text: '받는 피해를 줄여줍니다.',
        font: '12px sans-serif',
        maxWidth: 90,
        maxLines: 5
    }]);
    const itemText = commands.filter((command) => [
        '인형탈 ×1',
        '사용 가능',
        ...descriptionLines,
        '1/1'
    ].includes(command.text));
    assert.equal(itemText.length, 5);
    itemText.filter((command) => descriptionLines.includes(command.text))
        .forEach((command) => {
            assert.equal(command.x, 68);
            assert.equal(
                command.x + renderPort.measureText(command.text, command.font)
                    <= 158,
                true
            );
        });
    assert.equal(itemText.find((command) => command.text === '인형탈 ×1').x, 62);
    assert.equal(itemText.find((command) => command.text === '사용 가능').x, 62);
    const pageText = itemText.find((command) => command.text === '1/1');
    assert.deepEqual(
        { x: pageText.x, y: pageText.y, align: pageText.align },
        { x: 112.5, y: 535, align: 'center' }
    );
    assert.deepEqual(
        { x: playerPanel.x, y: playerPanel.y, w: playerPanel.w, h: playerPanel.h },
        { x: 67, y: 585, w: 274, h: 92 }
    );
    assert.equal(occupiedSlots.length, 5);
    assert.deepEqual(
        {
            x: occupiedSlots[0].x,
            y: occupiedSlots[0].y,
            w: occupiedSlots[0].w,
            h: occupiedSlots[0].h
        },
        { x: 111, y: 599, w: 38, h: 38 }
    );
    assert.deepEqual(
        { x: playerGauge.x, y: playerGauge.y, w: playerGauge.w, h: playerGauge.h },
        { x: 123, y: 650, w: 98.5, h: 7 }
    );
    assert.equal(
        commands.some((command) => command.fill === '#222'
            && command.x === 123 && command.y === 650),
        false
    );
    assert.equal(commands.some((command) => command.text === 'PLAYER · HP'), false);
    assert.equal(commands.some((command) => command.text === '50/100'), false);
});

test('전투 조사 포커스는 마우스 직접 선택과 키보드 순환에서 같은 키를 사용한다', () => {
    const focus = new TutorialBattleFocusController();
    focus.setKeys(['battle-heal', 'item-mirror']);
    assert.equal(focus.focus('item-mirror'), true);
    assert.equal(focus.getFocusedKey(), 'item-mirror');
    assert.equal(focus.shift(1), 'battle-heal');
    focus.setKeys(['item-mirror']);
    assert.equal(focus.getFocusedKey(), null);
});

test('첫 플레이 안내는 자동으로 열리고 확인 뒤 재플레이에서는 수동으로만 열린다', () => {
    const guidance = new TutorialGuidanceController();
    guidance.beginRun({ seen: false });
    assert.equal(guidance.isOpen(), true);
    assert.equal(guidance.dismiss(), true);
    guidance.beginRun({ seen: true });
    assert.equal(guidance.isOpen(), false);
    guidance.show();
    assert.equal(guidance.isOpen(), true);
});

test('전투 안내는 6개 원본 팝업 위치와 Figma 하단 건너뛰기 영역을 사용한다', () => {
    const commands = [];
    const renderPort = {
        render(layer, command) {
            commands.push({ layer, ...command });
        },
        measureText(text) {
            return String(text).length * 8;
        },
        wrapText(text) {
            return [String(text)];
        }
    };
    const layout = createLayout().resize(VIEWPORTS[0]);
    const view = new TutorialBattleTutorialView(renderPort);
    const viewModel = {
        open: true,
        viewport: VIEWPORTS[0],
        layout,
        fonts: { SMALL: '12px sans-serif' },
        colors: {
            UI: {
                CardShadow: '#000', Card: '#fff', Border: '#333',
                Primary: '#a00', Text: '#111', Muted: '#777',
                PrimaryHover: '#b00', OnPrimary: '#fff'
            }
        },
        copy: {
            sentences: Array.from({ length: 6 }, (_, index) => `안내 ${index + 1}`),
            replay: 'H로 다시 열기'
        }
    };
    view.draw(viewModel);
    const paperCards = commands.filter((command) => command.shape === 'roundRect');
    assert.equal(paperCards.length, 6);
    const [dismiss] = view.getButtonSpecs(viewModel);
    const skip = TUTORIAL_UI_LAYOUT_TOKENS.TUTORIAL.SKIP;
    assert.deepEqual(
        { x: dismiss.x, y: dismiss.y, w: dismiss.w, h: dismiss.h },
        {
            x: Math.round(skip.x * 1280),
            y: Math.round(skip.y * 720),
            w: Math.round(skip.w * 1280),
            h: Math.round(skip.h * 720)
        }
    );
    assert.equal(dismiss.drawBackground, false);
    assert.equal(dismiss.label, '');
});

test('가독성 프레젠터는 모델 수치를 재계산하지 않고 현재→예상 표시값을 보존한다', () => {
    const presenter = new TutorialCombatReadabilityPresenter({
        items: TUTORIAL_GAME_DATA.ITEMS,
        reasonCopy: TUTORIAL_GAME_DATA.TEXT.COMBAT_REASONS
    });
    const view = presenter.create({
        snapshot: {
            player: { hp: 70 },
            lora: { hp: 80, instability: 50 },
            consecutiveAttackCount: 1
        },
        loraIntent: {
            ok: true,
            forecast: true,
            actionType: 'area',
            stateLabel: '불안정',
            finalDamage: 40,
            affectsAll: true,
            reason: 'player-outside-melee-range'
        },
        actionPreview: {
            ok: true,
            reason: 'action-available',
            before: { playerHp: 70, loraHp: 80, instability: 50 },
            expected: {
                playerHp: 70,
                loraHp: 50,
                instability: 60,
                peaceTurns: 0,
                extraPlayerTurns: 0,
                consecutiveAttackCount: 2
            },
            changes: { consumedItemId: null, consumedItemCount: 0 }
        },
        selectionLabel: '근접 공격'
    });
    assert.equal(view.loraIntent.finalDamage, 40);
    assert.equal(view.loraIntent.rangeLabel, '전장 전체');
    assert.equal(view.playerPreview.before.loraHp, 80);
    assert.equal(view.playerPreview.expected.loraHp, 50);
    assert.match(view.playerPreview.persistentLabel, /연속 공격 2회/);
});

test('전투 뷰는 장면·모델·저장·명령 큐를 직접 import하지 않는다', async () => {
    const names = [
        '_tutorial_battle_layout.js',
        '_tutorial_battle_world_view.js',
        '_tutorial_battle_hud_view.js',
        '_tutorial_battle_command_menu_view.js',
        '_tutorial_battle_feedback_view.js',
        '_tutorial_achievement_view.js',
        '_tutorial_battle_tutorial_view.js'
    ];
    const sources = await Promise.all(names.map((name) => readFile(new URL(
        `../project/engine/script/scene/tutorial/view/${name}`,
        import.meta.url
    ), 'utf8')));
    const forbidden = [
        '_tutorial_scene.js',
        '_tutorial_battle_model.js',
        '_tutorial_meta_progress.js',
        'simulation_command_queue.js'
    ];
    for (const [index, source] of sources.entries()) {
        for (const dependency of forbidden) {
            assert.equal(
                source.includes(dependency),
                false,
                `${names[index]}가 ${dependency}에 직접 의존합니다.`
            );
        }
        assert.equal(
            (source.match(/export class /g) || []).length,
            1,
            `${names[index]}는 정확히 한 클래스를 내보내야 합니다.`
        );
    }
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TUTORIAL_ASSET_MANIFEST } from '../project/engine/script/data/game/tutorial_asset_manifest.js';
import { TutorialBattleHudView } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_hud_view.js';
import { TutorialBattleLayout } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_layout.js';
import { TutorialBattleTutorialView } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_tutorial_view.js';
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
    assert.deepEqual(active.command, { type: TUTORIAL_COMMANDS.PLAN_RESET, payload: undefined });
});

test('플레이어 아이템과 HP는 패널 원본의 슬롯과 하단 게이지에 맞춰진다', () => {
    const commands = [];
    const assets = {
        playerPanel: { naturalWidth: 232, naturalHeight: 78 },
        playerItemSelected: { naturalWidth: 32, naturalHeight: 32 }
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
    const entries = Array.from({ length: 5 }, (_, index) => ({
        itemId: 'item-' + String(index),
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
            readability: { playerPreview: null, inspectedItem: null },
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

    view.draw(viewModel);
    const playerPanel = commands.find((command) => command.image === assets.playerPanel);
    const occupiedSlots = commands.filter(
        (command) => command.image === assets.playerItemSelected
    );
    const playerGauge = commands.find(
        (command) => command.fill === '#hp' && command.x === 123 && command.y === 650
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

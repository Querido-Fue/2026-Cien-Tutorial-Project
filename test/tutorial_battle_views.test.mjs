import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { TutorialBattleHudView } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_hud_view.js';
import { TutorialBattleLayout } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_layout.js';

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

test('전투 뷰는 장면·모델·저장·명령 큐를 직접 import하지 않는다', async () => {
    const names = [
        '_tutorial_battle_layout.js',
        '_tutorial_battle_world_view.js',
        '_tutorial_battle_hud_view.js',
        '_tutorial_battle_feedback_view.js'
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

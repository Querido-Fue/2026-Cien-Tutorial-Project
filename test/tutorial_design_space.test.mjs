import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createTutorialDesignSpace,
    projectTutorialDesignRect,
    TUTORIAL_DESIGN_CANVAS
} from '../project/engine/script/scene/tutorial/view/_tutorial_design_space.js';
import { TUTORIAL_UI_LAYOUT_TOKENS } from '../project/engine/script/scene/tutorial/view/_tutorial_ui_layout_tokens.js';

test('1280×720 디자인 좌표계는 기준 화면과 정확히 일치한다', () => {
    const space = createTutorialDesignSpace({ UIWW: 1280, UIOffsetX: 0, WH: 720 });
    assert.deepEqual(space, {
        x: 0,
        y: 0,
        w: 1280,
        h: 720,
        scale: 1,
        designWidth: 1280,
        designHeight: 720
    });
    assert.equal(TUTORIAL_DESIGN_CANVAS.IMAGE_SMOOTHING, false);
});

test('울트라와이드에서는 16:9 UI safe area를 중앙에 고정한다', () => {
    const space = createTutorialDesignSpace({ UIWW: 1280, UIOffsetX: 160, WH: 720 });
    assert.equal(space.x, 160);
    assert.equal(space.y, 0);
    assert.equal(space.w, 1280);
    assert.equal(space.h, 720);
});

test('최소 높이 진단 화면은 같은 비율로 축소하고 정수 좌표를 사용한다', () => {
    const space = createTutorialDesignSpace({
        UIWW: 1137.7777777778,
        UIOffsetX: 71.1111111111,
        WH: 640
    });
    assert.deepEqual({ x: space.x, y: space.y, w: space.w, h: space.h }, {
        x: 71,
        y: 0,
        w: 1138,
        h: 640
    });
    assert.ok(Math.abs(space.scale - (8 / 9)) < 0.000001);
});

test('Figma 정규화 토큰은 모든 화면에서 safe area 내부로 투영된다', () => {
    const space = createTutorialDesignSpace({ UIWW: 1280, UIOffsetX: 160, WH: 720 });
    const tokens = [
        TUTORIAL_UI_LAYOUT_TOKENS.MAIN.LOGO,
        TUTORIAL_UI_LAYOUT_TOKENS.STARTER.LEFT_CARD,
        TUTORIAL_UI_LAYOUT_TOKENS.PAUSE.PANEL,
        TUTORIAL_UI_LAYOUT_TOKENS.BATTLE.ACTION,
        ...TUTORIAL_UI_LAYOUT_TOKENS.TUTORIAL.CALLOUTS,
        TUTORIAL_UI_LAYOUT_TOKENS.GALLERY.BOOK,
        TUTORIAL_UI_LAYOUT_TOKENS.RESULT.BOOK
    ];
    for (const token of tokens) {
        const projected = projectTutorialDesignRect(space, token);
        assert.ok(projected.x >= space.x);
        assert.ok(projected.y >= space.y);
        assert.ok(projected.x + projected.w <= space.x + space.w);
        assert.ok(projected.y + projected.h <= space.y + space.h);
        assert.equal(Number.isInteger(projected.x), true);
        assert.equal(Number.isInteger(projected.y), true);
        assert.equal(Number.isInteger(projected.w), true);
        assert.equal(Number.isInteger(projected.h), true);
    }
});


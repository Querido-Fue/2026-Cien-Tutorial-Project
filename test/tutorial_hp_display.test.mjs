import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_GAME_DATA } from '../project/engine/script/data/game/tutorial_game_data.js';
import { DarkTheme } from '../project/engine/script/data/theme/dark_theme.js';
import { LightTheme } from '../project/engine/script/data/theme/light_theme.js';
import { TutorialAnimationTimeline } from '../project/engine/script/scene/tutorial/_tutorial_animation_timeline.js';
import { TutorialBattlePresenter } from '../project/engine/script/scene/tutorial/_tutorial_battle_presenter.js';
import { TUTORIAL_PRESENTATION_CUE_TYPES } from '../project/engine/script/scene/tutorial/_tutorial_presentation_contract.js';
import { drawBattleHpValue } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_hp_value_view.js';
import { LORA_STATUS_PANEL_LAYOUT } from '../project/engine/script/scene/tutorial/view/_tutorial_battle_hud_layout.js';

/** @returns {object} HP 전환 테스트용 최소 전투 스냅샷입니다. */
function createHealthSnapshot(playerHp) {
    return {
        floorIndex: 0,
        player: { x: 4, y: 4, hp: playerHp, maxHp: 100 },
        lora: { x: 4, y: 0, hp: 100, maxHp: 100, instability: 70 }
    };
}

test('HP 표시값은 작은 장식 슬롯 중앙에 반올림한 실제 수치를 그린다', () => {
    const commands = [];
    drawBattleHpValue({
        render(layer, command) {
            commands.push({ layer, ...command });
        }
    }, {
        rect: { x: 100, y: 40, w: 24, h: 10 },
        value: 74.6,
        font: '500 14px LanaPixel, monospace',
        fill: '#2b2025'
    });

    assert.deepEqual(commands, [{
        layer: 'ui',
        shape: 'text',
        text: '75',
        x: 111,
        y: 46,
        font: '500 9px LanaPixel, monospace',
        fill: '#2b2025',
        align: 'center',
        baseline: 'middle',
        alpha: 1
    }]);
    assert.equal(DarkTheme.Tactics.UI.GaugeValue, '#2b2025');
    assert.equal(LightTheme.Tactics.UI.GaugeValue, '#2b2025');
});

test('HP 3자리·2자리·1자리 수치는 동일한 시각 중심 좌표를 사용한다', () => {
    const commands = [];
    const port = {
        render(layer, command) {
            commands.push({ layer, ...command });
        }
    };

    for (const value of [100, 70, 7]) {
        drawBattleHpValue(port, {
            rect: { x: 100, y: 40, w: 24, h: 10 },
            value,
            font: '500 14px LanaPixel, monospace',
            fill: '#2b2025'
        });
    }

    assert.deepEqual(commands.map(({ text, x, y, align, baseline }) => ({
        text,
        x,
        y,
        align,
        baseline
    })), [
        { text: '100', x: 111, y: 46, align: 'center', baseline: 'middle' },
        { text: '70', x: 111, y: 46, align: 'center', baseline: 'middle' },
        { text: '7', x: 111, y: 46, align: 'center', baseline: 'middle' }
    ]);
});

test('플레이어와 로라 HP 값은 원본 패널의 실측 노치 중심에 놓인다', () => {
    const playerRect = TUTORIAL_GAME_DATA.LAYOUT.INVENTORY.PLAYER_PANEL.HP_VALUE;
    const loraRect = LORA_STATUS_PANEL_LAYOUT.HP_VALUE;

    assert.equal(playerRect.X + (playerRect.WIDTH * 0.5), 121);
    assert.equal(loraRect.X + (loraRect.WIDTH * 0.5), 135);
});

test('HP 감소 표시값은 0.3초 easeOutExpo 표현 타임라인을 사용한다', () => {
    const animations = [];
    let nextId = 0;
    const presenter = new TutorialBattlePresenter({
        animation: TUTORIAL_GAME_DATA.ANIMATION
    });
    const timeline = new TutorialAnimationTimeline({
        config: TUTORIAL_GAME_DATA.ANIMATION,
        animationPort: {
            animate(owner, spec) {
                animations.push({ owner, spec });
                return { id: nextId++, promise: new Promise(() => {}) };
            },
            remove() {}
        }
    });
    timeline.reset({ playerHp: 100, loraHp: 100, instability: 70 });
    const cues = presenter.createCues({
        previousSnapshot: createHealthSnapshot(100),
        nextSnapshot: createHealthSnapshot(60),
        events: [{ type: 'player-damaged', amount: 40, hp: 60 }]
    });
    const healthCue = cues.find((cue) => (
        cue.type === TUTORIAL_PRESENTATION_CUE_TYPES.HEALTH_TRANSITION
        && cue.actorId === 'player'
    ));

    assert.equal(healthCue.duration, 0.3);
    timeline.applyCues(cues);
    assert.equal(animations.length, 1);
    assert.equal(animations[0].spec.variable, 'playerHp');
    assert.equal(animations[0].spec.endValue, 60);
    assert.equal(animations[0].spec.duration, 0.3);
    assert.equal(animations[0].spec.type, 'easeOutExpo');
    timeline.destroy();
});

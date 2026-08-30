import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { EFFECT_RENDER_CONSTANTS } from '../project/engine/script/data/display/effect_render_constants.js';
import {
    TUTORIAL_BATTLE_LIGHTING_DATA
} from '../project/engine/script/data/game/tutorial_battle_lighting_data.js';
import { LightTheme } from '../project/engine/script/data/theme/light_theme.js';
import {
    TutorialBattleLightingView
} from '../project/engine/script/scene/tutorial/view/_tutorial_battle_lighting_view.js';

const REGISTRY_URL = new URL(
    '../project/engine/script/display/webgl/_effect_pass_registry.js',
    import.meta.url
);
const PASS_URL = new URL(
    '../project/engine/script/display/webgl/_scene_lighting_effect_pass.js',
    import.meta.url
);

function createViewModel(floorId, ambientFire = null) {
    return {
        floor: { id: floorId },
        colors: LightTheme.Tactics,
        layout: {
            worldRect: { x: 0, y: 0, w: 1280, h: 720 },
            boardRect: { x: 120, y: 80, w: 970, h: 580 },
            mapImageRect: { x: 100, y: 70, w: 970, h: 580 },
            ambientFire
        },
        world: { elapsedSeconds: 3.5 }
    };
}

test('장면 조명은 전용 effect pass로 등록되고 비방향성 원형 감쇠를 사용한다', async () => {
    const [registry, pass] = await Promise.all([
        readFile(REGISTRY_URL, 'utf8'),
        readFile(PASS_URL, 'utf8')
    ]);

    assert.equal(EFFECT_RENDER_CONSTANTS.TYPES.SCENE_LIGHTING, 'sceneLighting');
    assert.match(registry, /EFFECT_TYPES\.SCENE_LIGHTING/);
    assert.match(registry, /new SceneLightingEffectPass\(gl\)/);
    assert.match(pass, /length\(fragmentPoint - u_center\)/);
    assert.match(pass, /gl\.blendFunc\(gl\.ONE, gl\.ONE_MINUS_SRC_COLOR\)/);
    assert.match(pass, /u_breathAmount/);
    assert.match(pass, /u_time \* 7\.4/);
    assert.match(pass, /gl\.SCISSOR_TEST/);
});

test('1층 양초는 실제 심지와 맵 중심 점대칭 광원을 함께 만든다', () => {
    const commands = [];
    const view = new TutorialBattleLightingView({
        renderGL: (layer, command) => commands.push({ layer, ...command })
    });
    const ambientFire = {
        alpha: 0.96,
        emitters: [
            { x: 180, y: 140, size: 6, phase: 0.2 },
            { x: 200, y: 150, size: 6, phase: 0.4 }
        ]
    };

    view.draw(createViewModel('first-floor', ambientFire), true);

    const lighting = commands[0];
    assert.equal(lighting.effectType, EFFECT_RENDER_CONSTANTS.TYPES.SCENE_LIGHTING);
    assert.equal(lighting.emitters.length, 2);
    assert.deepEqual(lighting.emitters[1], {
        x: 980,
        y: 575,
        radius: 90,
        phase: 0.8,
        intensityScale: 0.42
    });
    assert.ok(lighting.intensity <= 0.16);
    assert.ok(lighting.breathAmount > 0 && lighting.breathAmount < 0.06);
    assert.equal(commands[1].effectType, EFFECT_RENDER_CONSTANTS.TYPES.AMBIENT_DUST);
    assert.equal(commands[2].effectType, EFFECT_RENDER_CONSTANTS.TYPES.FLAME_PARTICLES);
    assert.equal(commands[2].emitters, ambientFire.emitters);
});

test('지하는 노출 0.6과 청색 색온도, 강화된 희미한 입자를 사용한다', () => {
    const commands = [];
    const view = new TutorialBattleLightingView({
        renderGL: (layer, command) => commands.push({ layer, ...command })
    });

    view.draw(createViewModel('basement'), true);

    const profile = TUTORIAL_BATTLE_LIGHTING_DATA.PROFILES.basement;
    const lighting = commands[0];
    const dust = commands[1];
    assert.equal(profile.EXPOSURE, 0.6);
    assert.equal(lighting.exposure, 0.6);
    assert.deepEqual(lighting.emitters, []);
    assert.equal(lighting.ambientColor, LightTheme.Tactics.Effects.BasementAmbient);
    assert.equal(dust.warmColor, LightTheme.Tactics.Effects.BasementMoteWarm);
    assert.equal(dust.coolColor, LightTheme.Tactics.Effects.BasementMoteCool);
    assert.ok(dust.alpha > TUTORIAL_BATTLE_LIGHTING_DATA
        .PROFILES['first-floor'].PARTICLES.ALPHA);
    assert.equal(commands.some((command) => (
        command.effectType === EFFECT_RENDER_CONSTANTS.TYPES.FLAME_PARTICLES
    )), false);
});

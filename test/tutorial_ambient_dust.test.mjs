import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { EFFECT_RENDER_CONSTANTS } from '../project/engine/script/data/display/effect_render_constants.js';

const SOURCE_URLS = Object.freeze({
    registry: new URL('../project/engine/script/display/webgl/_effect_pass_registry.js', import.meta.url),
    pass: new URL('../project/engine/script/display/webgl/_ambient_dust_effect_pass.js', import.meta.url),
    lightingView: new URL('../project/engine/script/scene/tutorial/view/_tutorial_battle_lighting_view.js', import.meta.url)
});

async function readSources() {
    return Object.fromEntries(await Promise.all(Object.entries(SOURCE_URLS).map(
        async ([key, url]) => [key, await readFile(url, 'utf8')]
    )));
}

test('인게임 먼지는 전용 WebGL effect pass에 등록된다', async () => {
    const { registry, pass } = await readSources();

    assert.equal(EFFECT_RENDER_CONSTANTS.TYPES.AMBIENT_DUST, 'ambientDust');
    assert.match(registry, /EFFECT_TYPES\.AMBIENT_DUST/);
    assert.match(registry, /new AmbientDustEffectPass\(gl\)/);
    assert.match(pass, /gl\.drawArrays\(gl\.POINTS/);
});

test('먼지는 작은 픽셀 격자에 고정되고 보드 영역 밖을 scissor로 잘라낸다', async () => {
    const { pass } = await readSources();

    assert.equal(EFFECT_RENDER_CONSTANTS.AMBIENT_DUST.PIXEL_GRID_SIZE, 2);
    assert.equal(EFFECT_RENDER_CONSTANTS.AMBIENT_DUST.MAX_POINT_SIZE, 2);
    assert.ok(EFFECT_RENDER_CONSTANTS.AMBIENT_DUST.MAX_PARTICLES_PER_COMMAND <= 64);
    assert.match(pass, /floor\(position \/ pixelSize\) \* pixelSize/);
    assert.match(pass, /gl\.SCISSOR_TEST/);
    assert.match(pass, /u_warmColor/);
    assert.match(pass, /u_coolColor/);
});

test('전투 조명 뷰는 먼지를 effect 레이어에 층별 제한 밀도로 전달한다', async () => {
    const { lightingView } = await readSources();

    assert.match(lightingView, /this\.#drawSceneLighting\(viewModel, profile, hasMapArtwork\);\s*this\.#drawAmbientDust\(viewModel, profile\);/);
    assert.match(lightingView, /renderGL\('effect', \{/);
    assert.match(lightingView, /effectType: EFFECT_TYPES\.AMBIENT_DUST/);
    assert.match(lightingView, /layout\.mapImageRect \|\| layout\.boardRect/);
    assert.match(lightingView, /particles\.MIN_COUNT/);
});

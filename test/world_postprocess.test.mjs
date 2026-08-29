import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    resolveWorldPostProcessQuality,
    WORLD_POSTPROCESS_CONSTANTS
} from '../project/engine/script/data/display/world_postprocess_constants.js';
import { EFFECT_RENDER_CONSTANTS } from '../project/engine/script/data/display/effect_render_constants.js';

const SOURCE_URLS = Object.freeze({
    index: new URL('../project/engine/index.html', import.meta.url),
    displaySystem: new URL('../project/engine/script/display/display_system.js', import.meta.url),
    handler: new URL('../project/engine/script/display/webgl/_webgl_handler.js', import.meta.url),
    pipeline: new URL('../project/engine/script/display/webgl/_world_postprocess_pipeline.js', import.meta.url),
    shaderUtils: new URL('../project/engine/script/display/webgl/_shader_utils.js', import.meta.url),
    flamePass: new URL('../project/engine/script/display/webgl/_flame_particle_effect_pass.js', import.meta.url),
    shieldPass: new URL('../project/engine/script/display/webgl/_magnetic_shield_effect_pass.js', import.meta.url)
});

async function readSources() {
    return Object.fromEntries(await Promise.all(Object.entries(SOURCE_URLS).map(
        async ([key, url]) => [key, await readFile(url, 'utf8')]
    )));
}

test('월드 후처리 surface는 effect와 texteffect/UI 사이에 위치한다', async () => {
    const { index } = await readSources();
    const effectIndex = index.indexOf('id="effect"');
    const postProcessIndex = index.indexOf('id="world-postprocess"');
    const textEffectIndex = index.indexOf('id="texteffect"');
    const uiIndex = index.indexOf('id="ui"');

    assert.ok(effectIndex >= 0);
    assert.ok(effectIndex < postProcessIndex);
    assert.ok(postProcessIndex < textEffectIndex);
    assert.ok(textEffectIndex < uiIndex);
    assert.deepEqual(WORLD_POSTPROCESS_CONSTANTS.SOURCE_LAYER_IDS, [
        'background', 'object', 'effect'
    ]);
    assert.equal(WORLD_POSTPROCESS_CONSTANTS.SOURCE_LAYER_IDS.includes('ui'), false);
    assert.equal(WORLD_POSTPROCESS_CONSTANTS.SOURCE_LAYER_IDS.includes('texteffect'), false);
});

test('Bloom은 정확히 1/4 해상도이며 렌더 스케일별 품질 단계가 존재한다', () => {
    assert.equal(WORLD_POSTPROCESS_CONSTANTS.BLOOM_SCALE, 0.25);
    assert.deepEqual(Object.keys(WORLD_POSTPROCESS_CONSTANTS.QUALITY_TIERS), [
        'low', 'medium', 'high'
    ]);
    assert.equal(resolveWorldPostProcessQuality(75), 'low');
    assert.equal(resolveWorldPostProcessQuality(82), 'medium');
    assert.equal(resolveWorldPostProcessQuality(94), 'medium');
    assert.equal(resolveWorldPostProcessQuality(95), 'high');
    assert.equal(resolveWorldPostProcessQuality(100), 'high');
    assert.ok(WORLD_POSTPROCESS_CONSTANTS.QUALITY_TIERS.low.bloomIntensity >= 0.28);
    assert.ok(WORLD_POSTPROCESS_CONSTANTS.QUALITY_TIERS.medium.bloomIntensity >= 0.4);
    assert.ok(WORLD_POSTPROCESS_CONSTANTS.QUALITY_TIERS.high.bloomIntensity >= 0.52);
});

test('기본 월드 영상은 NEAREST를 유지하고 Bloom 버퍼만 선형 필터링한다', async () => {
    const { pipeline } = await readSources();
    assert.match(pipeline, /createRenderTarget\(nextWidth, nextHeight, this\.gl\.NEAREST\)/);
    assert.match(pipeline, /createRenderTarget\(nextBloomWidth, nextBloomHeight, this\.gl\.LINEAR\)/);
    assert.match(pipeline, /u_shadowTint/);
    assert.match(pipeline, /u_highlightTint/);
    assert.match(pipeline, /orderedDither/);
    assert.match(pipeline, /u_vignetteAlpha/);
    assert.doesNotMatch(pipeline, /chromatic|motionBlur|motion_blur/i);
});

test('공유 FBO 명령은 background → object → effect 순서로 지연 실행된다', async () => {
    const { pipeline } = await readSources();
    assert.match(pipeline, /this\.commandQueues = new Map/);
    assert.match(pipeline, /queue\.push\(command\)/);
    assert.match(pipeline, /#flushWorldLayersInOrder\(\)/);
    assert.match(pipeline, /for \(const layerName of WORLD_LAYER_IDS\)/);
});

test('절차적 WebGL 효과는 화면 좌표를 픽셀 격자에 고정한다', async () => {
    const { shaderUtils, flamePass, shieldPass } = await readSources();
    assert.equal(EFFECT_RENDER_CONSTANTS.FLAME.PIXEL_GRID_SIZE, 2);
    assert.equal(EFFECT_RENDER_CONSTANTS.MAGNETIC_SHIELD.PIXEL_GRID_SIZE, 2);
    assert.match(shaderUtils, /uniform float u_pixelSize/g);
    assert.match(shaderUtils, /floor\(screenPoint \/ pixelSize\) \* pixelSize/);
    assert.match(shaderUtils, /floor\(rawFragCoord \/ pixelSize\) \* pixelSize/);
    assert.match(flamePass, /u_pixelSize/);
    assert.match(shieldPass, /u_pixelSize/);
});

test('화염은 둥근 물방울 실루엣과 넓은 발광 영역을 합성한다', async () => {
    const { shaderUtils } = await readSources();
    assert.match(shaderUtils, /float bulbMask/);
    assert.match(shaderUtils, /float tipWidth/);
    assert.match(shaderUtils, /float coreBulbMask/);
    assert.match(shaderUtils, /float bloomHalo/);
});

test('WebGL 오류 시 현재 월드 명령을 기존 레이어로 재생하는 폴백이 존재한다', async () => {
    const { handler, displaySystem, pipeline } = await readSources();
    assert.match(handler, /#fallbackToLegacy\(error, true\)/);
    assert.match(handler, /pendingWorldCommands/);
    assert.match(handler, /#prepareLegacyWorldFrame\(\)/);
    assert.match(pipeline, /webglcontextlost/);
    assert.match(pipeline, /#throwOnGlError\('frame composite'\)/);
    assert.match(displaySystem, /#isActiveCompositeSurface/);
    assert.match(displaySystem, /WORLD_POSTPROCESS_SOURCE_LAYER_ID_SET/);
});

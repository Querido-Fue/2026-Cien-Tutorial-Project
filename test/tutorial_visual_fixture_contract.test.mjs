import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
    TUTORIAL_VISUAL_FIXTURES,
    TUTORIAL_VISUAL_GOLDEN_POLICY
} from './fixtures/tutorial_visual_fixture_catalog.mjs';

const FIGMA_NODE_IDS = Object.freeze([
    '461:18', '461:19', '461:23',
    '464:25', '464:28', '464:31', '464:34', '464:37', '464:40',
    '466:24', '466:27', '466:30', '466:33'
]);

test('결정론적 시각 fixture는 Figma 13개 노드를 누락과 중복 없이 고정한다', () => {
    assert.equal(TUTORIAL_VISUAL_FIXTURES.length, 13);
    assert.deepEqual(
        TUTORIAL_VISUAL_FIXTURES.map((fixture) => fixture.figmaNodeId),
        FIGMA_NODE_IDS
    );
    assert.equal(new Set(TUTORIAL_VISUAL_FIXTURES.map((fixture) => fixture.key)).size, 13);
    assert.equal(new Set(TUTORIAL_VISUAL_FIXTURES.map(
        (fixture) => fixture.figmaNodeId
    )).size, 13);
    assert.equal(
        TUTORIAL_VISUAL_FIXTURES.every((fixture) => (
            typeof fixture.mode === 'string'
            && typeof fixture.variant === 'string'
            && Array.isArray(fixture.mask)
        )),
        true
    );
});

test('시각 fixture와 골든 정책은 안정된 직렬화 해시를 가진다', () => {
    const serialized = JSON.stringify({
        fixtures: TUTORIAL_VISUAL_FIXTURES,
        policy: TUTORIAL_VISUAL_GOLDEN_POLICY
    });
    assert.equal(
        createHash('sha256').update(serialized).digest('hex'),
        '6c85035dc196b4e6a2604c13d55174eec7847f7c645575de8bb14128eb84e7db'
    );
});

test('골든 정책은 고정 시계·nearest·expected/actual/diff 산출물을 요구한다', () => {
    assert.deepEqual(TUTORIAL_VISUAL_GOLDEN_POLICY.viewport, {
        width: 1280,
        height: 720
    });
    assert.equal(TUTORIAL_VISUAL_GOLDEN_POLICY.animationClockSeconds, 0);
    assert.equal(TUTORIAL_VISUAL_GOLDEN_POLICY.imageSmoothing, false);
    assert.deepEqual(TUTORIAL_VISUAL_GOLDEN_POLICY.artifacts, [
        'expected.png', 'actual.png', 'diff.png', 'metrics.json'
    ]);
    assert.ok(
        TUTORIAL_VISUAL_GOLDEN_POLICY.strictHudPixelDiffRatio
        < TUTORIAL_VISUAL_GOLDEN_POLICY.maskedWorldPixelDiffRatio
    );
});

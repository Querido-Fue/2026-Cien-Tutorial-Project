const CURSOR_MASK = Object.freeze(['cursor-glow']);
const BATTLE_MASK = Object.freeze([
    'cursor-glow',
    'actor-animation-frame',
    'floating-feedback',
    'teleport-pulse'
]);

/**
 * Figma `<<최종 UI>>`의 13개 평면 참조를 재현하는 결정론적 캡처 상태입니다.
 * 실제 캡처 실행기는 이 상태명으로 장면을 준비하고 mask 영역만 제외해 비교합니다.
 */
export const TUTORIAL_VISUAL_FIXTURES = Object.freeze([
    Object.freeze({
        key: 'result-turn-limit', figmaNodeId: '461:18', mode: 'result',
        variant: 'turn-limit', mask: CURSOR_MASK
    }),
    Object.freeze({
        key: 'starter-mascot-selected', figmaNodeId: '461:19', mode: 'starter',
        variant: 'mascot-costume', mask: CURSOR_MASK
    }),
    Object.freeze({
        key: 'pause-default', figmaNodeId: '461:23', mode: 'pause',
        variant: 'resume-focused', mask: BATTLE_MASK
    }),
    Object.freeze({
        key: 'gallery-media-locked', figmaNodeId: '464:25', mode: 'gallery',
        variant: 'endings-locked', mask: CURSOR_MASK
    }),
    Object.freeze({
        key: 'gallery-media-unlocked', figmaNodeId: '464:28', mode: 'gallery',
        variant: 'cutscenes-unlocked', mask: CURSOR_MASK
    }),
    Object.freeze({
        key: 'gallery-diary-lora', figmaNodeId: '464:31', mode: 'gallery',
        variant: 'lora-diary', mask: CURSOR_MASK
    }),
    Object.freeze({
        key: 'gallery-diary-developer', figmaNodeId: '464:34', mode: 'gallery',
        variant: 'developer-diary', mask: CURSOR_MASK
    }),
    Object.freeze({
        key: 'gallery-achievement-locked', figmaNodeId: '464:37', mode: 'gallery',
        variant: 'achievement-locked', mask: CURSOR_MASK
    }),
    Object.freeze({
        key: 'gallery-achievement-unlocked', figmaNodeId: '464:40', mode: 'gallery',
        variant: 'achievement-unlocked', mask: CURSOR_MASK
    }),
    Object.freeze({
        key: 'battle-first-floor-default', figmaNodeId: '466:24', mode: 'battle',
        variant: 'first-floor-default', mask: BATTLE_MASK
    }),
    Object.freeze({
        key: 'battle-item-achievement', figmaNodeId: '466:27', mode: 'battle',
        variant: 'item-focus-achievement', mask: BATTLE_MASK
    }),
    Object.freeze({
        key: 'battle-guidance', figmaNodeId: '466:30', mode: 'battle',
        variant: 'guidance-open', mask: BATTLE_MASK
    }),
    Object.freeze({
        key: 'main-empty-meta', figmaNodeId: '466:33', mode: 'menu',
        variant: 'continue-disabled', mask: CURSOR_MASK
    })
]);

export const TUTORIAL_VISUAL_GOLDEN_POLICY = Object.freeze({
    viewport: Object.freeze({ width: 1280, height: 720 }),
    deviceScaleFactor: 1,
    animationClockSeconds: 0,
    selectionProgress: 1,
    imageSmoothing: false,
    strictHudPixelDiffRatio: 0.004,
    maskedWorldPixelDiffRatio: 0.035,
    anchorTolerancePixels: 7,
    artifacts: Object.freeze(['expected.png', 'actual.png', 'diff.png', 'metrics.json'])
});

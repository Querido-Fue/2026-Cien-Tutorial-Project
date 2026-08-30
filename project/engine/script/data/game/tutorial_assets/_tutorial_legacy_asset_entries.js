import { createTutorialPngAssetEntry } from './_tutorial_asset_entry.js';

export const TUTORIAL_LEGACY_ASSET_IDS = Object.freeze({
    loraPortrait: 'character.lora.portrait',
    loraPortraitStable: 'character.lora.portrait.stable',
    loraPortraitAnxious: 'character.lora.portrait.anxious',
    loraPortraitShaken: 'character.lora.portrait.shaken',
    loraPortraitUnstable: 'character.lora.portrait.unstable',
    loraPortraitCollapse: 'character.lora.portrait.collapse',
    loraStatic: 'character.lora.static'
});

/**
 * @param {string} id 매니페스트 자산 ID입니다.
 * @param {string} stateId 불안정도 상태 ID입니다.
 * @param {string} stateLabel 사용자에게 보이는 상태 이름입니다.
 * @returns {Readonly<object>} 상태별 로라 초상 자산 항목입니다.
 */
function createLoraMoodPortraitEntry(id, stateId, stateLabel) {
    return createTutorialPngAssetEntry({
        id,
        runtimePath: `../asset/tutorial/characters/lora-portrait-${stateId}-pixel-v3.png`,
        sourceName: `generated/tutorial/characters/lora-portrait-${stateId}-pixel-v3.png`,
        expectedDimensions: { width: 1254, height: 1254 },
        actualDimensions: { width: 1254, height: 1254 },
        layer: 'portrait',
        usage: `로라 상태 패널의 ${stateLabel} 불안정도 표정`,
        required: true,
        pixelated: true
    });
}

export const TUTORIAL_LEGACY_ASSET_ENTRIES = Object.freeze([
    createTutorialPngAssetEntry({
        id: TUTORIAL_LEGACY_ASSET_IDS.loraPortrait,
        runtimePath: '../asset/tutorial/characters/lora-portrait-pixel-v2.png',
        sourceName: 'generated/tutorial/characters/lora-portrait-pixel-v2.png',
        expectedDimensions: { width: 1254, height: 1254 },
        actualDimensions: { width: 1254, height: 1254 },
        layer: 'portrait',
        usage: '로라 상태 패널 좌측 메달 슬롯용 정면 도트 얼굴 초상',
        required: true,
        pixelated: true
    }),
    createLoraMoodPortraitEntry(
        TUTORIAL_LEGACY_ASSET_IDS.loraPortraitStable,
        'stable',
        '안정'
    ),
    createLoraMoodPortraitEntry(
        TUTORIAL_LEGACY_ASSET_IDS.loraPortraitAnxious,
        'anxious',
        '불안'
    ),
    createLoraMoodPortraitEntry(
        TUTORIAL_LEGACY_ASSET_IDS.loraPortraitShaken,
        'shaken',
        '동요'
    ),
    createLoraMoodPortraitEntry(
        TUTORIAL_LEGACY_ASSET_IDS.loraPortraitUnstable,
        'unstable',
        '불안정'
    ),
    createLoraMoodPortraitEntry(
        TUTORIAL_LEGACY_ASSET_IDS.loraPortraitCollapse,
        'collapse',
        '붕괴'
    ),
    createTutorialPngAssetEntry({
        id: TUTORIAL_LEGACY_ASSET_IDS.loraStatic,
        runtimePath: '../asset/tutorial/characters/lora-static.png',
        sourceName: 'old/ui/tutorial/lora-sprite.png',
        expectedDimensions: { width: 1254, height: 1254 },
        actualDimensions: { width: 1254, height: 1254 },
        layer: 'world-actor',
        usage: '13턴 애니메이션 전까지 사용하는 로라 정적 폴백',
        required: true,
        pixelated: true
    })
]);

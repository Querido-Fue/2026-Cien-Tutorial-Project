import { createTutorialPngAssetEntry } from './_tutorial_asset_entry.js';

export const TUTORIAL_LEGACY_ASSET_IDS = Object.freeze({
    loraPortrait: 'character.lora.portrait',
    loraStatic: 'character.lora.static'
});

export const TUTORIAL_LEGACY_ASSET_ENTRIES = Object.freeze([
    createTutorialPngAssetEntry({
        id: TUTORIAL_LEGACY_ASSET_IDS.loraPortrait,
        runtimePath: '../asset/tutorial/characters/lora-portrait.png',
        sourceName: 'old/ui/tutorial/lora-portrait.png',
        expectedDimensions: { width: 200, height: 240 },
        actualDimensions: { width: 200, height: 240 },
        sourceRect: { x: 45, y: 20, w: 125, h: 125 },
        layer: 'portrait',
        usage: '로라 상태 패널 좌측 메달 슬롯용 얼굴 초상',
        required: true,
        pixelated: true
    }),
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

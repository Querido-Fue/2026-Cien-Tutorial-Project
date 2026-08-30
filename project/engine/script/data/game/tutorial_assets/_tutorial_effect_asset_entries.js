import { createTutorialPngAssetEntry } from './_tutorial_asset_entry.js';

export const TUTORIAL_EFFECT_ASSET_IDS = Object.freeze({
    loraAreaExplosion: 'effect.lora.area-explosion'
});

export const TUTORIAL_EFFECT_ASSET_ENTRIES = Object.freeze([
    createTutorialPngAssetEntry({
        id: TUTORIAL_EFFECT_ASSET_IDS.loraAreaExplosion,
        runtimePath: '../asset/tutorial/effects/lora-area-explosion.png',
        sourceName: 'img/effects/EXPLOSION!.png',
        expectedDimensions: { width: 12610, height: 580 },
        actualDimensions: { width: 12610, height: 580 },
        layer: 'texteffect',
        usage: '로라 전장 범위 공격의 970×580 13프레임 폭발 시트',
        required: true,
        pixelated: true
    })
]);

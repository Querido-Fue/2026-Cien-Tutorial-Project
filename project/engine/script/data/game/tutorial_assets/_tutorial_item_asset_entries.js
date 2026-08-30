import { createTutorialPngAssetEntry } from './_tutorial_asset_entry.js';

const ITEM_IDS = Object.freeze([
    'bow',
    'mascot-costume',
    'old-teddy',
    'music-box',
    'eyeliner',
    'diamond-pickaxe',
    'mirror',
    'mushroom',
    'ocarina',
    'haste',
    'memory-photo',
    'tile-cleanser',
    'record-page'
]);

export const TUTORIAL_ITEM_ASSET_IDS = Object.freeze({
    ...Object.fromEntries(ITEM_IDS.map((itemId) => (
        [itemId, 'item.' + itemId]
    )))
});

export const TUTORIAL_ITEM_ASSET_ENTRIES = Object.freeze([
    ...ITEM_IDS.map((itemId) => (
        createTutorialPngAssetEntry({
            id: TUTORIAL_ITEM_ASSET_IDS[itemId],
            runtimePath: '../asset/tutorial/ui/items/'
                + itemId + '-pixel-v2.png',
            sourceName: 'generated/tutorial/items/'
                + itemId + '-pixel-v2.png',
            expectedDimensions: { width: 32, height: 32 },
            actualDimensions: { width: 32, height: 32 },
            layer: 'item-icon',
            usage: itemId === 'record-page'
                ? '월드 일기·개발자 기록 페이지 아이콘'
                : itemId + ' 월드·인벤토리 아이콘',
            required: true,
            pixelated: true
        })
    ))
]);

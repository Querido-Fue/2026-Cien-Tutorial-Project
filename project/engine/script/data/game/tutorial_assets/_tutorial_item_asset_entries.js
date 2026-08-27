import {
    createTutorialGeneratedFallbackEntry,
    createTutorialPngAssetEntry
} from './_tutorial_asset_entry.js';

const ITEM_SOURCES = Object.freeze({
    bow: 'arrow',
    'mascot-costume': 'mask',
    'old-teddy': 'bear',
    'music-box': 'music box',
    eyeliner: 'eyeliner',
    'diamond-pickaxe': 'minecraft',
    mirror: 'mirror',
    mushroom: 'mario',
    ocarina: 'zelda',
    haste: 'maplestory',
    'memory-photo': 'picture'
});

export const TUTORIAL_ITEM_ASSET_IDS = Object.freeze({
    ...Object.fromEntries(Object.keys(ITEM_SOURCES).map((itemId) => (
        [itemId, 'item.' + itemId]
    ))),
    'tile-cleanser': 'item.tile-cleanser'
});

export const TUTORIAL_ITEM_ASSET_ENTRIES = Object.freeze([
    ...Object.entries(ITEM_SOURCES).map(([itemId, sourceStem]) => (
        createTutorialPngAssetEntry({
            id: TUTORIAL_ITEM_ASSET_IDS[itemId],
            runtimePath: '../asset/tutorial/ui/items/'
                + itemId.replaceAll(' ', '-') + '.png',
            sourceName: 'img/UI/ingame_item_' + sourceStem + '.png',
            expectedDimensions: { width: 16, height: 16 },
            actualDimensions: { width: 16, height: 16 },
            layer: 'item-icon',
            usage: itemId + ' 월드·인벤토리 아이콘',
            required: true,
            pixelated: true
        })
    )),
    createTutorialGeneratedFallbackEntry({
        id: TUTORIAL_ITEM_ASSET_IDS['tile-cleanser'],
        layer: 'item-icon',
        usage: '원본이 없는 타일 정화제의 한글 글리프 폴백'
    })
]);

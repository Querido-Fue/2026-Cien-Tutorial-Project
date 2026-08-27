import {
    TUTORIAL_ITEM_ASSET_ENTRIES,
    TUTORIAL_ITEM_ASSET_IDS
} from './tutorial_assets/_tutorial_item_asset_entries.js';
import {
    TUTORIAL_LEGACY_ASSET_ENTRIES,
    TUTORIAL_LEGACY_ASSET_IDS
} from './tutorial_assets/_tutorial_legacy_asset_entries.js';
import {
    TUTORIAL_MAP_ASSET_ENTRIES,
    TUTORIAL_MAP_ASSETS
} from './tutorial_assets/_tutorial_map_asset_entries.js';
import {
    TUTORIAL_UI_ASSET_ENTRIES,
    TUTORIAL_UI_ASSET_IDS
} from './tutorial_assets/_tutorial_ui_asset_entries.js';

const ENTRIES = Object.freeze([
    ...TUTORIAL_MAP_ASSET_ENTRIES,
    ...TUTORIAL_UI_ASSET_ENTRIES,
    ...TUTORIAL_ITEM_ASSET_ENTRIES,
    ...TUTORIAL_LEGACY_ASSET_ENTRIES
]);

/**
 * 튜토리얼 원본과 안전한 런타임 복사본 사이의 단일 에셋 계약입니다.
 */
export const TUTORIAL_ASSET_MANIFEST = Object.freeze({
    VERSION: 1,
    SOURCE_ROOT: 'project/asset',
    RUNTIME_ROOT: 'project/asset/tutorial',
    ENTRIES,
    MAPS: TUTORIAL_MAP_ASSETS,
    UI: TUTORIAL_UI_ASSET_IDS,
    ITEMS: TUTORIAL_ITEM_ASSET_IDS,
    LEGACY: TUTORIAL_LEGACY_ASSET_IDS
});

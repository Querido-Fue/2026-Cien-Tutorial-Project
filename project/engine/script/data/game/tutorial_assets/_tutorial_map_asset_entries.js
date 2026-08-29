import { createTutorialPngAssetEntry } from './_tutorial_asset_entry.js';

const MAP_DIMENSIONS = Object.freeze({ width: 970, height: 580 });

const FIRST_FLOOR_AMBIENT_FIRE = Object.freeze({
    sourceSize: 6,
    alpha: 0.96,
    emitters: Object.freeze([
        Object.freeze({ x: 99, y: 157, phase: 0.08 }),
        Object.freeze({ x: 121, y: 148, phase: 0.47 }),
        Object.freeze({ x: 221, y: 75, phase: 0.21 }),
        Object.freeze({ x: 243, y: 66, phase: 0.72 }),
        Object.freeze({ x: 587, y: 70, phase: 0.36 }),
        Object.freeze({ x: 609, y: 79, phase: 0.89 }),
        Object.freeze({ x: 709, y: 118, phase: 0.14 }),
        Object.freeze({ x: 731, y: 127, phase: 0.61 }),
        Object.freeze({ x: 790, y: 151, phase: 0.31 }),
        Object.freeze({ x: 812, y: 160, phase: 0.82 })
    ])
});

/** @param {object} entry @returns {Readonly<object>} 맵 PNG 항목입니다. */
function createMapEntry(entry) {
    return createTutorialPngAssetEntry({
        ...entry,
        expectedDimensions: MAP_DIMENSIONS,
        actualDimensions: MAP_DIMENSIONS,
        pixelated: true
    });
}

export const TUTORIAL_MAP_ASSET_ENTRIES = Object.freeze([
    createMapEntry({
        id: 'map.first-floor.background',
        runtimePath: '../asset/tutorial/maps/first-floor-background.png',
        sourceName: 'img/map/map_floor1_background.png',
        layer: 'map-background',
        usage: '1층 방 배경 레이어',
        fallback: 'map.first-floor.full'
    }),
    createMapEntry({
        id: 'map.first-floor.grid',
        runtimePath: '../asset/tutorial/maps/first-floor-grid.png',
        sourceName: 'img/map/map_floor1_carpet.png',
        layer: 'map-grid',
        usage: '1층 9×8 카펫 격자 레이어',
        fallback: 'map.first-floor.full'
    }),
    createMapEntry({
        id: 'map.first-floor.full',
        runtimePath: '../asset/tutorial/maps/first-floor-full.png',
        sourceName: 'img/map/map_floor1_full.png',
        layer: 'map-composite',
        usage: '1층 분리 레이어 실패 시 합성 폴백'
    }),
    createMapEntry({
        id: 'map.basement.background',
        runtimePath: '../asset/tutorial/maps/basement-background.png',
        sourceName: 'img/map/map_B1_background.png',
        layer: 'map-background',
        usage: '지하층 방 배경 레이어',
        fallback: 'map.basement.full'
    }),
    createMapEntry({
        id: 'map.basement.grid',
        runtimePath: '../asset/tutorial/maps/basement-grid.png',
        sourceName: 'img/map/map_B1_carpet.png',
        layer: 'map-grid',
        usage: '지하층 9×8 카펫 격자 레이어',
        fallback: 'map.basement.full'
    }),
    createMapEntry({
        id: 'map.basement.full',
        runtimePath: '../asset/tutorial/maps/basement-full.png',
        sourceName: 'img/map/map_B1_full.png',
        layer: 'map-composite',
        usage: '지하층 분리 레이어 실패 시 합성 폴백'
    })
]);

export const TUTORIAL_MAP_ASSETS = Object.freeze({
    'first-floor': Object.freeze({
        sourceDimensions: MAP_DIMENSIONS,
        backgroundId: 'map.first-floor.background',
        gridId: 'map.first-floor.grid',
        fullId: 'map.first-floor.full',
        ambientFire: FIRST_FLOOR_AMBIENT_FIRE,
        gridQuad: Object.freeze({
            top: Object.freeze({ x: 467, y: 136 }),
            right: Object.freeze({ x: 917, y: 316 }),
            bottom: Object.freeze({ x: 581, y: 540 }),
            left: Object.freeze({ x: 131, y: 360 })
        })
    }),
    basement: Object.freeze({
        sourceDimensions: MAP_DIMENSIONS,
        backgroundId: 'map.basement.background',
        gridId: 'map.basement.grid',
        fullId: 'map.basement.full',
        gridQuad: Object.freeze({
            top: Object.freeze({ x: 468, y: 136 }),
            right: Object.freeze({ x: 917, y: 316 }),
            bottom: Object.freeze({ x: 581, y: 540 }),
            left: Object.freeze({ x: 131, y: 360 })
        })
    })
});

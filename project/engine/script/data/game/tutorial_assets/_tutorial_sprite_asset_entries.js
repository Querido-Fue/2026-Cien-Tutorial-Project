import { createTutorialPngAssetEntry } from './_tutorial_asset_entry.js';

export const TUTORIAL_SPRITE_ASSET_IDS = Object.freeze({
    playerWalk: 'sprite.player.walk',
    playerBreathing: 'sprite.player.breathing',
    playerMelee: 'sprite.player.melee',
    playerRanged: 'sprite.player.ranged',
    playerHit: 'sprite.player.hit',
    playerHeal: 'sprite.player.heal',
    playerItem: 'sprite.player.item',
    loraWalk: 'sprite.lora.walk',
    loraBreathing: 'sprite.lora.breathing',
    loraMelee: 'sprite.lora.melee',
    loraArea: 'sprite.lora.area',
    loraHit: 'sprite.lora.hit',
    loraUnstable: 'sprite.lora.unstable',
    loraCollapse: 'sprite.lora.collapse',
    slimeBlue: 'sprite.slime.blue',
    slimeGreen: 'sprite.slime.green'
});

/** @param {object} entry @returns {Readonly<object>} 캐릭터 스프라이트 시트 항목입니다. */
function createSpriteEntry(entry) {
    return createTutorialPngAssetEntry({
        ...entry,
        layer: 'world-actor',
        required: true,
        pixelated: true
    });
}

export const TUTORIAL_SPRITE_ASSET_ENTRIES = Object.freeze([
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.playerWalk,
        runtimePath: '../asset/tutorial/characters/player/walk.png',
        sourceName: 'img/characters in-game model/Walking/main character.png',
        expectedDimensions: { width: 256, height: 256 },
        actualDimensions: { width: 256, height: 256 },
        usage: '플레이어 4방향 대기·걷기 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.playerBreathing,
        runtimePath: '../asset/tutorial/characters/player/breathing.png',
        sourceName: 'img/characters in-game model/Breathing/main character breathing.png',
        expectedDimensions: { width: 1216, height: 64 },
        actualDimensions: { width: 1216, height: 64 },
        usage: '플레이어 좌우 대기의 몸·머리 분리 호흡 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.playerMelee,
        runtimePath: '../asset/tutorial/characters/player/melee.png',
        sourceName: 'img/characters in-game model/Melee/main character melee.png',
        expectedDimensions: { width: 1216, height: 256 },
        actualDimensions: { width: 1216, height: 256 },
        usage: '플레이어 좌우 근접 공격과 검격 레이어 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.playerRanged,
        runtimePath: '../asset/tutorial/characters/player/ranged.png',
        sourceName: 'img/characters in-game model/Range/main character range.png',
        expectedDimensions: { width: 1216, height: 192 },
        actualDimensions: { width: 1216, height: 192 },
        usage: '플레이어 좌우 원거리 공격 7프레임과 화살 투사체 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.playerHit,
        runtimePath: '../asset/tutorial/characters/player/hit.png',
        sourceName: 'img/characters in-game model/Hit/main character hit.png',
        expectedDimensions: { width: 1216, height: 128 },
        actualDimensions: { width: 1216, height: 128 },
        usage: '플레이어 좌우 피격 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.playerHeal,
        runtimePath: '../asset/tutorial/characters/player/heal.png',
        sourceName: 'img/characters in-game model/Heal/main character heal.png',
        expectedDimensions: { width: 1216, height: 128 },
        actualDimensions: { width: 1216, height: 128 },
        usage: '플레이어 좌우 회복 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.playerItem,
        runtimePath: '../asset/tutorial/characters/player/item.png',
        sourceName: 'img/characters in-game model/Item/main character item.png',
        expectedDimensions: { width: 1216, height: 128 },
        actualDimensions: { width: 1216, height: 128 },
        usage: '플레이어 좌우 아이템 사용 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.loraWalk,
        runtimePath: '../asset/tutorial/characters/lora/walk.png',
        sourceName: 'img/characters in-game model/Walking/Lola-sheet.png',
        expectedDimensions: { width: 296, height: 296 },
        actualDimensions: { width: 296, height: 296 },
        usage: '기존 로라 4방향 보행 호환 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.loraBreathing,
        runtimePath: '../asset/tutorial/characters/lora/breathing.png',
        sourceName: 'img/characters in-game model/Breathing/rora breathing.png',
        expectedDimensions: { width: 256, height: 64 },
        actualDimensions: { width: 256, height: 64 },
        usage: '로라 좌우 대기의 몸·머리 분리 호흡 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.loraMelee,
        runtimePath: '../asset/tutorial/characters/lora/melee.png',
        sourceName: 'img/characters in-game model/Melee/Rora melee.png',
        expectedDimensions: { width: 320, height: 128 },
        actualDimensions: { width: 320, height: 128 },
        usage: '로라 좌우 근접 공격 5프레임 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.loraArea,
        runtimePath: '../asset/tutorial/characters/lora/area.png',
        sourceName: 'img/characters in-game model/Range/Rora range magic.png',
        expectedDimensions: { width: 384, height: 128 },
        actualDimensions: { width: 384, height: 128 },
        usage: '로라 좌우 전장 범위 마법 6프레임 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.loraHit,
        runtimePath: '../asset/tutorial/characters/lora/hit.png',
        sourceName: 'img/characters in-game model/Hit/Rora hit.png',
        expectedDimensions: { width: 256, height: 128 },
        actualDimensions: { width: 256, height: 128 },
        usage: '로라 좌우 피격 점멸 4프레임 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.loraUnstable,
        runtimePath: '../asset/tutorial/characters/lora/unstable.png',
        sourceName: 'img/characters in-game model/Unstable/Rora unstable.png',
        expectedDimensions: { width: 256, height: 128 },
        actualDimensions: { width: 256, height: 128 },
        usage: '로라 불안정도 61~80 좌우 대기 루프'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.loraCollapse,
        runtimePath: '../asset/tutorial/characters/lora/collapse.png',
        sourceName: 'img/characters in-game model/Collapsed/Rora collapsed.png',
        expectedDimensions: { width: 256, height: 128 },
        actualDimensions: { width: 256, height: 128 },
        usage: '로라 불안정도 81~100 좌우 붕괴 대기 루프'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.slimeBlue,
        runtimePath: '../asset/tutorial/characters/slime/blue.png',
        sourceName: 'img/characters in-game model/Slime/Slime.png',
        expectedDimensions: { width: 640, height: 256 },
        actualDimensions: { width: 640, height: 256 },
        usage: '1층 슬라임 대기·공격·피격·사망 시트'
    }),
    createSpriteEntry({
        id: TUTORIAL_SPRITE_ASSET_IDS.slimeGreen,
        runtimePath: '../asset/tutorial/characters/slime/green.png',
        sourceName: 'img/characters in-game model/Slime/Slime green.png',
        expectedDimensions: { width: 640, height: 256 },
        actualDimensions: { width: 640, height: 256 },
        usage: '지하층 슬라임 대기·공격·피격·사망 시트'
    })
]);

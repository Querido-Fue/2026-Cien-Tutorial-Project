import { createTutorialPngAssetEntry } from './_tutorial_asset_entry.js';

export const TUTORIAL_SPRITE_ASSET_IDS = Object.freeze({
    playerWalk: 'sprite.player.walk',
    playerMelee: 'sprite.player.melee',
    playerHit: 'sprite.player.hit',
    playerHeal: 'sprite.player.heal',
    playerItem: 'sprite.player.item',
    loraWalk: 'sprite.lora.walk',
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
        id: TUTORIAL_SPRITE_ASSET_IDS.playerMelee,
        runtimePath: '../asset/tutorial/characters/player/melee.png',
        sourceName: 'img/characters in-game model/Melee/main character melee.png',
        expectedDimensions: { width: 1216, height: 256 },
        actualDimensions: { width: 1216, height: 256 },
        usage: '플레이어 좌우 근접 공격과 검격 레이어 시트'
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
        usage: '로라 4방향 대기 시트와 누락 동작의 명시적 폴백'
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

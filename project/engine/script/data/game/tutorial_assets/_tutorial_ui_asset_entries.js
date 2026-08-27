import { createTutorialPngAssetEntry } from './_tutorial_asset_entry.js';

/** @param {object} entry @returns {Readonly<object>} UI PNG 항목입니다. */
function createUiEntry(entry) {
    return createTutorialPngAssetEntry({
        ...entry,
        layer: entry.layer || 'ui',
        pixelated: true
    });
}

export const TUTORIAL_UI_ASSET_IDS = Object.freeze({
    mainCameraOverlay: 'ui.main.camera-overlay',
    mainTitle: 'ui.main.title',
    mainButton: 'ui.main.button',
    starterCard: 'ui.starter.card',
    turnFrame: 'ui.battle.turn-frame',
    loraPanel: 'ui.battle.lora-panel',
    playerPanel: 'ui.battle.player-panel',
    actionButton: 'ui.battle.action-button',
    waitHealButton: 'ui.battle.wait-heal-button',
    itemPanel: 'ui.battle.item-panel',
    tutorialPopup: 'ui.battle.tutorial-popup',
    achievementPopup: 'ui.battle.achievement-popup'
});

export const TUTORIAL_UI_ASSET_ENTRIES = Object.freeze([
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.mainCameraOverlay,
        runtimePath: '../asset/tutorial/ui/main/camera-overlay.png',
        sourceName: 'img/UI/main_icons.png',
        expectedDimensions: { width: 1920, height: 1080 },
        actualDimensions: { width: 1920, height: 1080 },
        usage: '메인 화면 카메라 프레임과 모서리 장식'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.mainTitle,
        runtimePath: '../asset/tutorial/ui/main/title.png',
        sourceName: 'img/UI/main_title.png',
        expectedDimensions: { width: 512, height: 256 },
        actualDimensions: { width: 512, height: 256 },
        sourceRect: { x: 21, y: 18, w: 312, h: 159 },
        usage: '메인 타이틀 로고'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.mainButton,
        runtimePath: '../asset/tutorial/ui/main/button.png',
        sourceName: 'img/UI/main_button.png',
        expectedDimensions: { width: 256, height: 64 },
        actualDimensions: { width: 256, height: 64 },
        sourceRect: { x: 5, y: 6, w: 153, h: 26 },
        usage: '런타임 한글 라벨을 얹는 공통 메인 버튼'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.starterCard,
        runtimePath: '../asset/tutorial/ui/starter/card.png',
        sourceName: 'img/UI/select_button.png',
        expectedDimensions: { width: 512, height: 256 },
        actualDimensions: { width: 512, height: 256 },
        sourceRect: { x: 16, y: 16, w: 143, h: 206 },
        usage: '스타터 선택 카드 빈 프레임'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.turnFrame,
        runtimePath: '../asset/tutorial/ui/battle/turn-frame.png',
        sourceName: 'img/UI/ingame_turn_background.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 177, h: 29 },
        usage: '런타임 턴 숫자를 얹는 진행 프레임'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.loraPanel,
        runtimePath: '../asset/tutorial/ui/battle/lora-panel.png',
        sourceName: 'img/UI/ingame_lorastate_itemslotempty.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 247, h: 90 },
        usage: '로라 상태와 런타임 게이지를 담는 빈 패널'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.playerPanel,
        runtimePath: '../asset/tutorial/ui/battle/player-panel.png',
        sourceName: 'img/UI/ingame_playerstate_full.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 232, h: 78 },
        usage: '플레이어 체력과 인벤토리 상태 패널'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.actionButton,
        runtimePath: '../asset/tutorial/ui/battle/action-button.png',
        sourceName: 'img/UI/ingame_actionbutton.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 135, h: 96 },
        usage: '런타임 행동 라벨을 얹는 행동 버튼'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.waitHealButton,
        runtimePath: '../asset/tutorial/ui/battle/wait-heal-button.png',
        sourceName: 'img/UI/ingame_waithealbutton.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 40, h: 40 },
        usage: '대기와 회복 행동의 보조 픽셀 프레임'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.itemPanel,
        runtimePath: '../asset/tutorial/ui/battle/item-panel.png',
        sourceName: 'img/UI/ingame_itemeexplaination_background.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 86, h: 128 },
        usage: '런타임 아이템 설명을 담는 빈 패널'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.tutorialPopup,
        runtimePath: '../asset/tutorial/ui/battle/tutorial-popup.png',
        sourceName: 'img/UI/tutorial_popup_nohighlight.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 96, h: 84 },
        usage: '런타임 전투 안내 문구를 담는 팝업'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.achievementPopup,
        runtimePath: '../asset/tutorial/ui/battle/achievement-popup.png',
        sourceName: 'img/UI/ingame_achievementalarm_background.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 147, h: 18 },
        usage: '런타임 발견 업적 문구를 담는 알림 배경'
    })
]);

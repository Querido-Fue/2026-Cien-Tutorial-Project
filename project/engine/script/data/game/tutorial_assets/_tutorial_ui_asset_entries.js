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
    achievementPopup: 'ui.battle.achievement-popup',
    pausePanel: 'ui.pause.panel',
    turnBefore: 'ui.battle.turn-before',
    turnDuring: 'ui.battle.turn-during',
    turnPassed: 'ui.battle.turn-passed',
    loraGaugeBar: 'ui.battle.lora-gauge-bar',
    loraHpBar: 'ui.battle.lora-hp-bar',
    loraItemSlotOn: 'ui.battle.lora-item-slot-on',
    loraItemSlotOff: 'ui.battle.lora-item-slot-off',
    playerItemSelected: 'ui.battle.player-item-selected',
    waitIcon: 'ui.battle.wait-icon',
    healIcon: 'ui.battle.heal-icon',
    teleportMarker: 'ui.battle.teleport-marker',
    wallBarrier: 'ui.battle.wall-barrier',
    dialogueBubble: 'ui.battle.dialogue-bubble',
    tutorialPaper: 'ui.battle.tutorial-paper',
    tutorialRodTop: 'ui.battle.tutorial-rod-top',
    tutorialRodBottom: 'ui.battle.tutorial-rod-bottom',
    achievementFull: 'ui.battle.achievement-full',
    achievementItemBackground: 'ui.battle.achievement-item-background',
    itemExplanationFlag: 'ui.battle.item-explanation-flag',
    itemExplanationFull: 'ui.battle.item-explanation-full',
    itemExplanationRod: 'ui.battle.item-explanation-rod',
    loraPanelFull: 'ui.battle.lora-panel-full',
    turnFrameFull: 'ui.battle.turn-frame-full',
    tutorialPopupFull: 'ui.battle.tutorial-popup-full',
    galleryAchievementDisplay: 'ui.gallery.achievement-display',
    galleryAchievementLocked: 'ui.gallery.achievement-locked',
    galleryTitleOn: 'ui.gallery.title-on',
    galleryTitleOff: 'ui.gallery.title-off',
    galleryBookmarkRedLeft: 'ui.gallery.bookmark-red-left',
    galleryBookmarkRedRight: 'ui.gallery.bookmark-red-right',
    galleryBookmarkBlueRight: 'ui.gallery.bookmark-blue-right',
    galleryBookmarkYellowLeft: 'ui.gallery.bookmark-yellow-left',
    galleryBookmarkYellowRight: 'ui.gallery.bookmark-yellow-right',
    galleryExitButton: 'ui.gallery.exit-button',
    galleryTurnButton: 'ui.gallery.turn-button',
    endingBook1: 'ui.ending.book-1',
    endingBook2: 'ui.ending.book-2',
    endingBook3: 'ui.ending.book-3',
    endingBook4: 'ui.ending.book-4',
    endingLetters: 'ui.ending.letters'
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
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.pausePanel,
        runtimePath: '../asset/tutorial/ui/pause/panel.png',
        sourceName: 'img/UI/pause_button.png',
        expectedDimensions: { width: 512, height: 256 },
        actualDimensions: { width: 512, height: 256 },
        sourceRect: { x: 16, y: 16, w: 197, h: 163 },
        usage: '전투 상태를 보존하는 Pause 세로 메뉴 패널'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.turnBefore,
        runtimePath: '../asset/tutorial/ui/battle/turn-before.png',
        sourceName: 'img/UI/ingame_turn_before.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 15, h: 15 },
        usage: '아직 진행하지 않은 로라 턴 핍'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.turnDuring,
        runtimePath: '../asset/tutorial/ui/battle/turn-during.png',
        sourceName: 'img/UI/ingame_turn_during.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 15, h: 15 },
        usage: '현재 로라 턴 핍'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.turnPassed,
        runtimePath: '../asset/tutorial/ui/battle/turn-passed.png',
        sourceName: 'img/UI/ingame_turn_passed.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 15, h: 15 },
        usage: '이미 지난 로라 턴 핍'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.loraGaugeBar,
        runtimePath: '../asset/tutorial/ui/battle/lora-gauge-bar.png',
        sourceName: 'img/UI/ingame_lorastate_bar.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 80, h: 4 },
        usage: '로라 상태 게이지 공통 픽셀 바'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.loraHpBar,
        runtimePath: '../asset/tutorial/ui/battle/lora-hp-bar.png',
        sourceName: 'img/UI/ingame_lorastate_hpbar.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 80, h: 4 },
        usage: '로라 HP 픽셀 바'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.loraItemSlotOn,
        runtimePath: '../asset/tutorial/ui/battle/lora-item-slot-on.png',
        sourceName: 'img/UI/ingame_lorastate_itemslot_on.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 30, h: 30 },
        usage: '활성 로라 아이템 슬롯'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.loraItemSlotOff,
        runtimePath: '../asset/tutorial/ui/battle/lora-item-slot-off.png',
        sourceName: 'img/UI/ingame_lorastate_itemslot_off.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 30, h: 30 },
        usage: '비활성 로라 아이템 슬롯'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.playerItemSelected,
        runtimePath: '../asset/tutorial/ui/battle/player-item-selected.png',
        sourceName: 'img/UI/ingame_playerstate_itemselect.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 32, h: 32 },
        usage: '플레이어 인벤토리 선택 강조'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.waitIcon,
        runtimePath: '../asset/tutorial/ui/battle/wait-icon.png',
        sourceName: 'img/UI/ingame_waiticon.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 12, h: 14 },
        usage: '대기 보조 행동 아이콘'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.healIcon,
        runtimePath: '../asset/tutorial/ui/battle/heal-icon.png',
        sourceName: 'img/UI/ingame_healicon.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 12, h: 12 },
        usage: '회복 보조 행동 아이콘'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.teleportMarker,
        runtimePath: '../asset/tutorial/ui/battle/teleport-marker.png',
        sourceName: 'img/UI/ingame_teleport.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 59, h: 32 },
        usage: '월드 포탈 마커'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.wallBarrier,
        runtimePath: '../asset/tutorial/world/low-spike-barricade.png',
        sourceName: 'generated/tutorial/world/low-spike-barricade.png',
        expectedDimensions: { width: 1536, height: 1024 },
        actualDimensions: { width: 1536, height: 1024 },
        sourceRect: { x: 14, y: 35, w: 1510, h: 918 },
        layer: 'object',
        usage: '뒤쪽 타일을 가리지 않는 낮은 파괴 가능 가시 울타리'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.dialogueBubble,
        runtimePath: '../asset/tutorial/ui/battle/dialogue-bubble.png',
        sourceName: 'img/UI/dialogue_bubble.png',
        expectedDimensions: { width: 760, height: 540 },
        actualDimensions: { width: 760, height: 540 },
        sourceRect: { x: 16, y: 16, w: 676, h: 96 },
        usage: '상황별 짧은 대사와 컨텍스트 툴팁 배경'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.tutorialPaper,
        runtimePath: '../asset/tutorial/ui/battle/tutorial-paper.png',
        sourceName: 'img/UI/tutorial_popup_paper.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 72, h: 62 },
        usage: 'HUD 지향 튜토리얼 콜아웃 종이'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.tutorialRodTop,
        runtimePath: '../asset/tutorial/ui/battle/tutorial-rod-top.png',
        sourceName: 'img/UI/tutorial_popup_rod_top.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 96, h: 14 },
        usage: '튜토리얼 콜아웃 상단 장식 막대'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.tutorialRodBottom,
        runtimePath: '../asset/tutorial/ui/battle/tutorial-rod-bottom.png',
        sourceName: 'img/UI/tutorial_popup_rod_bottom.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 96, h: 14 },
        usage: '튜토리얼 콜아웃 하단 장식 막대'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.achievementFull,
        runtimePath: '../asset/tutorial/ui/battle/achievement-full.png',
        sourceName: 'img/UI/ingame_achievementalarm_full.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 151, h: 57 },
        usage: '업적 알림 완성 프레임 참조'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.achievementItemBackground,
        runtimePath: '../asset/tutorial/ui/battle/achievement-item-background.png',
        sourceName: 'img/UI/ingame_achievementalarm_itembackground.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 50, h: 36 },
        usage: '업적 알림 아이콘 배경'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.itemExplanationFlag,
        runtimePath: '../asset/tutorial/ui/battle/item-explanation-flag.png',
        sourceName: 'img/UI/ingame_itemeexplaination_flag.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 72, h: 119 },
        usage: '상황별 아이템 설명 플래그 레이어'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.itemExplanationFull,
        runtimePath: '../asset/tutorial/ui/battle/item-explanation-full.png',
        sourceName: 'img/UI/ingame_itemeexplaination_full.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 86, h: 128 },
        usage: '아이템 설명 완성 프레임 참조'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.itemExplanationRod,
        runtimePath: '../asset/tutorial/ui/battle/item-explanation-rod.png',
        sourceName: 'img/UI/ingame_itemeexplaination_rod.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 86, h: 10 },
        usage: '아이템 설명 하단 장식 막대'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.loraPanelFull,
        runtimePath: '../asset/tutorial/ui/battle/lora-panel-full.png',
        sourceName: 'img/UI/ingame_lorastate_full.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 247, h: 90 },
        usage: '로라 상태 패널 원본 조합 확인용'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.turnFrameFull,
        runtimePath: '../asset/tutorial/ui/battle/turn-frame-full.png',
        sourceName: 'img/UI/ingame_turn_full.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 177, h: 29 },
        usage: '턴 프레임 원본 조합 확인용'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.tutorialPopupFull,
        runtimePath: '../asset/tutorial/ui/battle/tutorial-popup-full.png',
        sourceName: 'img/UI/tutorial_popup_full.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 100, h: 88 },
        usage: '튜토리얼 팝업 원본 조합 확인용'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.galleryAchievementDisplay,
        runtimePath: '../asset/tutorial/ui/gallery/achievement-display.png',
        sourceName: 'img/UI/gallery_acheivementdisplay.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 96, h: 112 },
        usage: '갤러리에서 해금한 업적을 표시하는 픽셀 프레임'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.galleryAchievementLocked,
        runtimePath: '../asset/tutorial/ui/gallery/achievement-locked.png',
        sourceName: 'img/UI/gallery_achievement_off.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 50, h: 50 },
        usage: '갤러리의 잠긴 업적 표시'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.galleryTitleOn,
        runtimePath: '../asset/tutorial/ui/gallery/title-on.png',
        sourceName: 'img/UI/gallery_title_on.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 141, h: 26 },
        usage: '선택된 갤러리 제목 탭'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.galleryTitleOff,
        runtimePath: '../asset/tutorial/ui/gallery/title-off.png',
        sourceName: 'img/UI/gallery_title_off.png',
        expectedDimensions: { width: 512, height: 300 },
        actualDimensions: { width: 512, height: 300 },
        sourceRect: { x: 16, y: 16, w: 141, h: 26 },
        usage: '선택되지 않은 갤러리 제목 탭'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.galleryBookmarkRedLeft,
        runtimePath: '../asset/tutorial/ui/gallery/bookmark-red-left.png',
        sourceName: 'img/UI/gallery_bookmark_red_left.png',
        expectedDimensions: { width: 512, height: 256 },
        actualDimensions: { width: 512, height: 256 },
        sourceRect: { x: 16, y: 16, w: 98, h: 38 },
        usage: '업적 갤러리 책갈피'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.galleryBookmarkRedRight,
        runtimePath: '../asset/tutorial/ui/gallery/bookmark-red-right.png',
        sourceName: 'img/UI/gallery_bookmark_red_right.png',
        expectedDimensions: { width: 512, height: 256 },
        actualDimensions: { width: 512, height: 256 },
        sourceRect: { x: 16, y: 16, w: 98, h: 38 },
        usage: '엔딩 갤러리 책갈피'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.galleryBookmarkBlueRight,
        runtimePath: '../asset/tutorial/ui/gallery/bookmark-blue-right.png',
        sourceName: 'img/UI/gallery_bookmark_blue_right.png',
        expectedDimensions: { width: 512, height: 256 },
        actualDimensions: { width: 512, height: 256 },
        sourceRect: { x: 16, y: 16, w: 98, h: 39 },
        usage: '컷씬 갤러리 책갈피'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.galleryBookmarkYellowLeft,
        runtimePath: '../asset/tutorial/ui/gallery/bookmark-yellow-left.png',
        sourceName: 'img/UI/gallery_bookmark_yellow_left.png',
        expectedDimensions: { width: 512, height: 256 },
        actualDimensions: { width: 512, height: 256 },
        sourceRect: { x: 16, y: 16, w: 98, h: 40 },
        usage: '로라의 일기 책갈피'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.galleryBookmarkYellowRight,
        runtimePath: '../asset/tutorial/ui/gallery/bookmark-yellow-right.png',
        sourceName: 'img/UI/gallery_bookmark_yellow_right.png',
        expectedDimensions: { width: 512, height: 256 },
        actualDimensions: { width: 512, height: 256 },
        sourceRect: { x: 16, y: 16, w: 98, h: 40 },
        usage: '개발자의 일기 책갈피'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.galleryExitButton,
        runtimePath: '../asset/tutorial/ui/gallery/exit-button.png',
        sourceName: 'img/UI/gallery_exitbutton.png',
        expectedDimensions: { width: 512, height: 256 },
        actualDimensions: { width: 512, height: 256 },
        sourceRect: { x: 16, y: 16, w: 32, h: 32 },
        usage: '갤러리 닫기 버튼 배경'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.galleryTurnButton,
        runtimePath: '../asset/tutorial/ui/gallery/turn-button.png',
        sourceName: 'img/UI/gallery_turnbutton_right_on.png',
        expectedDimensions: { width: 512, height: 256 },
        actualDimensions: { width: 512, height: 256 },
        sourceRect: { x: 16, y: 16, w: 19, h: 32 },
        usage: '갤러리 페이지 넘김 버튼 배경'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.endingBook1,
        runtimePath: '../asset/tutorial/ui/ending/book-1.png',
        sourceName: 'img/UI/ending_book1.png',
        expectedDimensions: { width: 578, height: 477 },
        actualDimensions: { width: 578, height: 477 },
        usage: '갤러리와 결과 화면의 열린 책 프레임'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.endingBook2,
        runtimePath: '../asset/tutorial/ui/ending/book-2.png',
        sourceName: 'img/UI/ending_book2.png',
        expectedDimensions: { width: 578, height: 477 },
        actualDimensions: { width: 578, height: 477 },
        usage: '갤러리 페이지 넘김 두 번째 프레임'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.endingBook3,
        runtimePath: '../asset/tutorial/ui/ending/book-3.png',
        sourceName: 'img/UI/ending_book3.png',
        expectedDimensions: { width: 578, height: 477 },
        actualDimensions: { width: 578, height: 477 },
        usage: '갤러리 페이지 넘김 세 번째 프레임'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.endingBook4,
        runtimePath: '../asset/tutorial/ui/ending/book-4.png',
        sourceName: 'img/UI/ending_book4.png',
        expectedDimensions: { width: 578, height: 477 },
        actualDimensions: { width: 578, height: 477 },
        usage: '갤러리 페이지 넘김 네 번째 프레임'
    }),
    createUiEntry({
        id: TUTORIAL_UI_ASSET_IDS.endingLetters,
        runtimePath: '../asset/tutorial/ui/ending/letters.png',
        sourceName: 'img/UI/ending_letters.png',
        expectedDimensions: { width: 512, height: 256 },
        actualDimensions: { width: 512, height: 256 },
        sourceRect: { x: 16, y: 16, w: 201, h: 57 },
        usage: '결과 화면 왼쪽 페이지의 the end 이미지'
    })
]);

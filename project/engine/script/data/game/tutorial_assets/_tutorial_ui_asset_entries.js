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

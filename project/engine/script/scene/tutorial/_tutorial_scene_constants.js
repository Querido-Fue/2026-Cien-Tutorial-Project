/**
 * TutorialScene이 사용하는 화면 모드 식별자입니다.
 * @type {Readonly<Record<string,string>>}
 */
export const TUTORIAL_MODES = Object.freeze({
    LOADING: 'loading',
    MENU: 'menu',
    STARTER: 'starter',
    BATTLE: 'battle',
    RESULT: 'result',
    GALLERY: 'gallery'
});

/**
 * 입력과 UI가 프레임 경계로 전달하는 튜토리얼 명령 식별자입니다.
 * @type {Readonly<Record<string,string>>}
 */
export const TUTORIAL_COMMANDS = Object.freeze({
    META_READY: 'tutorial/meta-ready',
    START: 'tutorial/start',
    OPEN_GALLERY: 'tutorial/open-gallery',
    RETURN_MENU: 'tutorial/return-menu',
    STARTER_SHIFT: 'tutorial/starter-shift',
    CHOOSE_STARTER: 'tutorial/choose-starter',
    RESTART: 'tutorial/restart',
    GALLERY_SHIFT: 'tutorial/gallery-shift',
    GALLERY_PLAY: 'tutorial/gallery-play',
    CUTSCENE_NEXT: 'tutorial/cutscene-next',
    CUTSCENE_CLOSE: 'tutorial/cutscene-close',
    PLAN_STEP: 'tutorial/plan-step',
    PLAN_BACK: 'tutorial/plan-back',
    COMMIT_PATH: 'tutorial/commit-path',
    SELECT_ATTACK: 'tutorial/select-attack',
    ATTACK: 'tutorial/attack',
    HEAL: 'tutorial/heal',
    IDLE: 'tutorial/idle',
    USE_ITEM: 'tutorial/use-item',
    INVENTORY_PAGE_SHIFT: 'tutorial/inventory-page-shift',
    SELECT_CLEANSE: 'tutorial/select-cleanse',
    CLEANSE_EVENT_TILE: 'tutorial/cleanse-event-tile',
    PERFORM_LORA: 'tutorial/perform-lora',
    COMPLETE_LORA: 'tutorial/complete-lora'
});

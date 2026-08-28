import { TUTORIAL_MODES } from './_tutorial_scene_constants.js';

/**
 * 모드별 표시와 명령 허용 범위를 정의하는 불변 정책 표입니다.
 * @type {Readonly<Record<string,Readonly<object>>>}
 */
export const TUTORIAL_MODE_POLICIES = Object.freeze({
    [TUTORIAL_MODES.LOADING]: Object.freeze({
        view: 'loading',
        buttons: null,
        canReturnMenu: false,
        canRestartRun: false,
        acceptsBattleInput: false
    }),
    [TUTORIAL_MODES.MENU]: Object.freeze({
        view: 'menu',
        buttons: 'menu',
        canReturnMenu: true,
        canRestartRun: false,
        acceptsBattleInput: false
    }),
    [TUTORIAL_MODES.STARTER]: Object.freeze({
        view: 'starter',
        buttons: 'starter',
        canReturnMenu: true,
        canRestartRun: false,
        acceptsBattleInput: false
    }),
    [TUTORIAL_MODES.BATTLE]: Object.freeze({
        view: 'battle',
        buttons: 'battle',
        canReturnMenu: true,
        canRestartRun: true,
        acceptsBattleInput: true
    }),
    [TUTORIAL_MODES.PAUSE]: Object.freeze({
        view: 'pause',
        buttons: 'pause',
        canReturnMenu: true,
        canRestartRun: true,
        acceptsBattleInput: false
    }),
    [TUTORIAL_MODES.RESULT]: Object.freeze({
        view: 'result',
        buttons: 'result',
        canReturnMenu: true,
        canRestartRun: true,
        acceptsBattleInput: false
    }),
    [TUTORIAL_MODES.GALLERY]: Object.freeze({
        view: 'gallery',
        buttons: 'gallery',
        canReturnMenu: true,
        canRestartRun: false,
        acceptsBattleInput: false
    })
});

/**
 * 모드의 표시·입력 정책을 반환합니다.
 * @param {*} mode - 확인할 모드입니다.
 * @returns {Readonly<object>|null} 등록된 정책 또는 null입니다.
 */
export function getTutorialModePolicy(mode) {
    return TUTORIAL_MODE_POLICIES[mode] || null;
}

/**
 * 지정 모드에서 메뉴 복귀 명령을 받을 수 있는지 확인합니다.
 * @param {*} mode - 확인할 모드입니다.
 * @returns {boolean} 메뉴 복귀 허용 여부입니다.
 */
export function canReturnToTutorialMenu(mode) {
    return getTutorialModePolicy(mode)?.canReturnMenu === true;
}

/**
 * 지정 모드에서 현재 런 재시작 명령을 받을 수 있는지 확인합니다.
 * @param {*} mode - 확인할 모드입니다.
 * @returns {boolean} 재시작 허용 여부입니다.
 */
export function canRestartTutorialRun(mode) {
    return getTutorialModePolicy(mode)?.canRestartRun === true;
}

/**
 * 지정 모드가 플레이어 전투 입력을 받는 모드인지 확인합니다.
 * @param {*} mode - 확인할 모드입니다.
 * @returns {boolean} 전투 입력 모드 여부입니다.
 */
export function isTutorialBattleMode(mode) {
    return getTutorialModePolicy(mode)?.acceptsBattleInput === true;
}

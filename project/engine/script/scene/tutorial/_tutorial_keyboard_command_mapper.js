import {
    TUTORIAL_KEY_CODES as KEY_CODES,
    TUTORIAL_KEY_DIRECTIONS as KEY_DIRECTIONS,
    TUTORIAL_SELECTION_KEY_CODES as SELECTION_KEY_CODES
} from './_tutorial_input_bindings.js';
import {
    TUTORIAL_COMMANDS as COMMANDS,
    TUTORIAL_MODES as MODES
} from './_tutorial_scene_constants.js';

/**
 * 이번 프레임의 키 상승 에지를 장면 상태에 맞는 명령 하나로 변환합니다.
 */
export class TutorialKeyboardCommandMapper {
    /**
     * @param {object} state - 입력 판정에 필요한 읽기 전용 장면 상태입니다.
     * @param {readonly string[]} pressedCodes - 이번 프레임 상승 에지 키 목록입니다.
     * @returns {object|null} 시뮬레이션 명령 사양입니다.
     */
    map(state, pressedCodes) {
        const pressed = new Set(pressedCodes);
        const wasPressed = (code) => pressed.has(code);
        const wasAnyPressed = (codes) => codes.some(wasPressed);

        if (state.mode === MODES.LOADING || state.presentationLocked) {
            return null;
        }
        if (state.cutsceneOpen) {
            if (wasPressed(KEY_CODES.CONFIRM)
                || wasPressed(KEY_CODES.ALTERNATE_CONFIRM)) {
                return { type: COMMANDS.CUTSCENE_NEXT };
            }
            return wasPressed(KEY_CODES.CANCEL)
                ? { type: COMMANDS.CUTSCENE_CLOSE }
                : null;
        }
        if (state.mode === MODES.MENU) {
            if (wasPressed(KEY_CODES.GALLERY)) {
                return { type: COMMANDS.OPEN_GALLERY };
            }
            return wasPressed(KEY_CODES.CONFIRM)
                ? { type: COMMANDS.START }
                : null;
        }
        if (state.mode === MODES.CHANGELOG) {
            if (wasAnyPressed(SELECTION_KEY_CODES.PREVIOUS)) {
                return this.#shiftCommand(COMMANDS.CHANGELOG_SHIFT, -1);
            }
            if (wasAnyPressed(SELECTION_KEY_CODES.NEXT)) {
                return this.#shiftCommand(COMMANDS.CHANGELOG_SHIFT, 1);
            }
            return wasPressed(KEY_CODES.CANCEL)
                ? { type: COMMANDS.RETURN_MENU }
                : null;
        }
        if (state.mode === MODES.STARTER) {
            if (wasAnyPressed(SELECTION_KEY_CODES.PREVIOUS)) {
                return this.#shiftCommand(COMMANDS.STARTER_SHIFT, -1);
            }
            if (wasAnyPressed(SELECTION_KEY_CODES.NEXT)) {
                return this.#shiftCommand(COMMANDS.STARTER_SHIFT, 1);
            }
            if (wasPressed(KEY_CODES.CONFIRM)) {
                return { type: COMMANDS.CHOOSE_STARTER };
            }
            return wasPressed(KEY_CODES.CANCEL)
                ? { type: COMMANDS.RETURN_MENU }
                : null;
        }
        if (state.mode === MODES.PAUSE) {
            if (wasPressed(KEY_CODES.CANCEL)) {
                return { type: COMMANDS.RESUME };
            }
            if (wasPressed(KEY_CODES.RESTART)) {
                return { type: COMMANDS.RESTART };
            }
            if (wasAnyPressed(SELECTION_KEY_CODES.PREVIOUS)) {
                return this.#shiftCommand(COMMANDS.PAUSE_SHIFT, -1);
            }
            if (wasAnyPressed(SELECTION_KEY_CODES.NEXT)) {
                return this.#shiftCommand(COMMANDS.PAUSE_SHIFT, 1);
            }
            if (wasPressed(KEY_CODES.CONFIRM)
                || wasPressed(KEY_CODES.ALTERNATE_CONFIRM)) {
                return {
                    type: [COMMANDS.RESUME, COMMANDS.RESTART, COMMANDS.RETURN_MENU][
                        state.pauseIndex
                    ]
                };
            }
            return null;
        }
        if (state.mode === MODES.GALLERY || state.mode === MODES.RECORD) {
            const direction = KEY_DIRECTIONS.find(
                (entry) => wasAnyPressed(entry.codes)
            );
            if (direction?.y) {
                return this.#shiftCommand(
                    COMMANDS.GALLERY_SECTION_SHIFT,
                    direction.y
                );
            }
            if (direction?.x) {
                return this.#shiftCommand(COMMANDS.GALLERY_SHIFT, direction.x);
            }
            if (wasPressed(KEY_CODES.CONFIRM)) {
                return { type: COMMANDS.GALLERY_PLAY };
            }
            if (wasPressed(KEY_CODES.CANCEL)) {
                return {
                    type: state.mode === MODES.RECORD
                        ? COMMANDS.CLOSE_RECORD
                        : COMMANDS.RETURN_MENU
                };
            }
            return null;
        }
        if (state.mode === MODES.RESULT) {
            if (wasPressed(KEY_CODES.RESTART)) {
                return { type: COMMANDS.RESTART };
            }
            return wasPressed(KEY_CODES.CANCEL)
                ? { type: COMMANDS.RETURN_MENU }
                : null;
        }
        if (state.mode !== MODES.BATTLE) {
            return null;
        }
        if (state.guidanceOpen) {
            return wasPressed(KEY_CODES.GUIDE)
                || wasPressed(KEY_CODES.CONFIRM)
                || wasPressed(KEY_CODES.CANCEL)
                ? { type: COMMANDS.GUIDE_DISMISS }
                : null;
        }
        if (wasPressed(KEY_CODES.GUIDE)) {
            return { type: COMMANDS.GUIDE_SHOW };
        }
        if (wasPressed(KEY_CODES.RESTART)) {
            return { type: COMMANDS.RESTART };
        }
        if (wasPressed(KEY_CODES.CANCEL)) {
            return { type: COMMANDS.PAUSE };
        }
        if (!state.canAcceptBattleInput) {
            return null;
        }
        if (wasPressed(KEY_CODES.PATH_BACK)) {
            return { type: COMMANDS.PLAN_BACK };
        }

        const direction = KEY_DIRECTIONS.find(
            (entry) => wasAnyPressed(entry.codes)
        );
        if (direction) {
            return {
                type: COMMANDS.PLAN_STEP,
                payload: { x: direction.x, y: direction.y }
            };
        }
        if (wasPressed(KEY_CODES.TARGET_NEXT)) {
            return state.attackSelected || state.cleanseSelected
                ? { type: COMMANDS.PLAN_STEP, payload: { x: 1, y: 0 } }
                : { type: COMMANDS.FOCUS_SHIFT, payload: { delta: 1 } };
        }
        if (wasPressed(KEY_CODES.CONFIRM)) {
            if (state.cleanseSelected) {
                return {
                    type: COMMANDS.CLEANSE_EVENT_TILE,
                    payload: state.selectedCleanseTarget
                };
            }
            if (state.attackSelected) {
                return {
                    type: COMMANDS.ATTACK,
                    payload: { targetId: state.selectedAttackTargetId }
                };
            }
            if (state.modelPhase === 'action' && state.focusedBattleCommand) {
                return state.focusedBattleCommand;
            }
            return state.modelPhase === 'move'
                ? { type: COMMANDS.COMMIT_PATH }
                : null;
        }
        if (wasPressed(KEY_CODES.ACTION_MELEE)) {
            return {
                type: COMMANDS.SELECT_ATTACK,
                payload: { weapon: 'melee' }
            };
        }
        if (wasPressed(KEY_CODES.ACTION_RANGED)) {
            return {
                type: COMMANDS.SELECT_ATTACK,
                payload: { weapon: 'bow' }
            };
        }
        if (wasPressed(KEY_CODES.ACTION_HEAL)) {
            return { type: COMMANDS.HEAL };
        }
        if (wasPressed(KEY_CODES.ACTION_IDLE)
            || wasPressed(KEY_CODES.ALTERNATE_CONFIRM)) {
            return { type: COMMANDS.IDLE };
        }
        return null;
    }

    /** @param {string} type @param {number} delta @returns {object} */
    #shiftCommand(type, delta) {
        return { type, payload: { delta } };
    }
}

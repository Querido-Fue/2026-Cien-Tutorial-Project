import {
    getCanvasOffset,
    getScaleRatio,
    getWH,
    getWW
} from 'display/display_system.js';
import { DebugModeToggleHandler } from './_debug_mode_toggle_handler.js';
import { MouseButtonStateMachine } from './_mouse_button_state_machine.js';
import { resolveFiniteNumber } from 'util/number_util.js';

/**
 * 마우스 입력의 기본 포커스 레이어 목록입니다.
 * @type {ReadonlyArray<string>}
 */
const DEFAULT_MOUSE_FOCUS_LIST = Object.freeze(['ui', 'object']);

/**
 * @class MouseInputHandler
 * @description 마우스 입력을 관리하는 클래스입니다.
 * 마우스 위치와 버튼별 상태 배열을 추적합니다.
 */
export class MouseInputHandler {
    /**
     * @param {{pointerLockInputHandler?:object|null}} [options={}] - 포인터 잠금 상태 포트입니다.
     */
    constructor(options = {}) {
        this.mousePos = { x: 0, y: 0 };
        this.pointerLockInputHandler = options.pointerLockInputHandler || null;
        this.relativeMouseEvents = new WeakSet();
        this.buttonStateMachine = new MouseButtonStateMachine(new DebugModeToggleHandler());
        this.mouseButtons = this.buttonStateMachine.mouseButtons;
        this.wheelState = {
            deltaX: 0,
            deltaY: 0,
            lastDeltaX: 0,
            lastDeltaY: 0,
            activeFrames: 0,
            eventCount: 0
        };

        this.focusList = [...DEFAULT_MOUSE_FOCUS_LIST];

        window.addEventListener('mousemove', (e) => {
            this.#updateMousePosition(e);
        });
        document.addEventListener('mousemove', (e) => {
            this.#updateMousePosition(e);
        });
        window.addEventListener('mousedown', (e) => {
            this.#updateMousePosition(e);
            this.buttonStateMachine.queueButtonStateChange(e.button, 'press', e.timeStamp);
        });
        window.addEventListener('mouseup', (e) => {
            this.#updateMousePosition(e);
            this.buttonStateMachine.queueButtonStateChange(e.button, 'release', e.timeStamp);
        });
        window.addEventListener('wheel', (e) => {
            this.#updateMousePosition(e);
            this.wheelState.deltaX += resolveFiniteNumber(Number(e.deltaX), 0);
            this.wheelState.deltaY += resolveFiniteNumber(Number(e.deltaY), 0);
            this.wheelState.lastDeltaX = resolveFiniteNumber(Number(e.deltaX), 0);
            this.wheelState.lastDeltaY = resolveFiniteNumber(Number(e.deltaY), 0);
            this.wheelState.activeFrames = 10;
            this.wheelState.eventCount += 1;
        }, { passive: true });
        window.addEventListener('blur', () => {
            this.buttonStateMachine.setAllButtonsInactive();
            this.#resetWheelState();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.buttonStateMachine.setAllButtonsInactive();
                this.#resetWheelState();
            }
        });
        document.addEventListener('mouseleave', () => {
            if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
                return;
            }
            this.buttonStateMachine.resetAllButtons();
        });
    }

    /**
     * @private
     * DOM 이벤트 좌표를 내부 렌더 좌표로 변환합니다.
     * @param {MouseEvent} event - 원본 마우스 이벤트
     */
    #updateMousePosition(event) {
        const scale = resolveFiniteNumber(Number(getScaleRatio()), 1);
        if (this.pointerLockInputHandler?.isLocked?.()) {
            if (event && typeof event === 'object') {
                if (this.relativeMouseEvents.has(event)) {
                    return;
                }
                this.relativeMouseEvents.add(event);
            }
            const movementX = resolveFiniteNumber(Number(event?.movementX), 0) * scale;
            const movementY = resolveFiniteNumber(Number(event?.movementY), 0) * scale;
            this.mousePos.x = Math.min(
                Math.max(1, resolveFiniteNumber(Number(getWW()), 1)),
                Math.max(0, this.mousePos.x + movementX)
            );
            this.mousePos.y = Math.min(
                Math.max(1, resolveFiniteNumber(Number(getWH()), 1)),
                Math.max(0, this.mousePos.y + movementY)
            );
            this.pointerLockInputHandler?.recordPointerMovement?.({
                pointerX: this.mousePos.x,
                pointerY: this.mousePos.y,
                viewportWidth: getWW(),
                viewportHeight: getWH(),
                movementX,
                movementY
            });
            return;
        }
        this.setMouseClientPosition(event);
    }

    /**
     * 시스템 커서 좌표를 내부 렌더 좌표에 동기화합니다.
     * 재잠금 직전 시스템 커서와 게임 커서가 같은 위치에서 교대하도록 사용합니다.
     * @param {{clientX?:number,clientY?:number}|null} position - 브라우저 클라이언트 좌표입니다.
     */
    setMouseClientPosition(position) {
        const scale = resolveFiniteNumber(Number(getScaleRatio()), 1);
        const offset = getCanvasOffset();
        const offsetX = resolveFiniteNumber(Number(offset?.x), 0);
        const offsetY = resolveFiniteNumber(Number(offset?.y), 0);
        const clientX = resolveFiniteNumber(Number(position?.clientX), offsetX);
        const clientY = resolveFiniteNumber(Number(position?.clientY), offsetY);
        this.mousePos.x = Math.min(
            Math.max(1, resolveFiniteNumber(Number(getWW()), 1)),
            Math.max(0, (clientX - offsetX) * scale)
        );
        this.mousePos.y = Math.min(
            Math.max(1, resolveFiniteNumber(Number(getWH()), 1)),
            Math.max(0, (clientY - offsetY) * scale)
        );
    }

    /**
     * 입력 상태를 업데이트합니다. (주로 마우스 클릭 상태 처리)
     */
    update() {
        this.buttonStateMachine.updateAll();

        if (this.wheelState.activeFrames > 0) {
            this.wheelState.activeFrames -= 1;
            return;
        }

        this.wheelState.deltaX = 0;
        this.wheelState.deltaY = 0;
    }

    /**
     * 마우스 입력 상태를 강제로 초기화합니다.
     * 창 비활성화 후 복귀 시 눌림 상태가 남지 않도록 사용합니다.
     * @param {{inactive?: boolean}} [options={}] - inactive 상태로 전환할지 여부입니다.
     */
    resetMouseInput(options = {}) {
        if (options.inactive === true) {
            this.buttonStateMachine.setAllButtonsInactive();
            this.#resetWheelState();
            return;
        }

        this.buttonStateMachine.resetAllButtons();
        this.#resetWheelState();
    }

    /**
     * 마우스 관련 정보를 반환합니다.
     * @param {string} key - 요청할 데이터 키 (pos, x, y, left, right, middle)
     * @returns {any} 마우스 데이터
     */
    getMouseInput(key) {
        switch (key) {
            case 'pos':
                return this.mousePos;
            case 'y':
                return this.mousePos.y;
            case 'x':
                return this.mousePos.x;
            case 'left':
                return this.buttonStateMachine.getButtonState('left');
            case 'right':
                return this.buttonStateMachine.getButtonState('right');
            case 'middle':
                return this.buttonStateMachine.getButtonState('middle');
            case 'wheel':
                return {
                    deltaX: this.wheelState.deltaX,
                    deltaY: this.wheelState.deltaY,
                    lastDeltaX: this.wheelState.lastDeltaX,
                    lastDeltaY: this.wheelState.lastDeltaY,
                    active: this.wheelState.activeFrames > 0,
                    eventCount: this.wheelState.eventCount
                };
        }
        return null;
    }

    /**
     * 휠 입력 상태를 초기화합니다.
     * @private
     */
    #resetWheelState() {
        this.wheelState.deltaX = 0;
        this.wheelState.deltaY = 0;
        this.wheelState.lastDeltaX = 0;
        this.wheelState.lastDeltaY = 0;
        this.wheelState.activeFrames = 0;
    }

    /**
     * 지정한 버튼 상태가 현재 활성인지 확인합니다.
     * 기본적으로 이미 소비된 `clicked` 상태는 제외합니다.
     * @param {'left'|'right'|'middle'} buttonName - 검사할 버튼 이름입니다.
     * @param {'inactive'|'idle'|'click'|'clicking'|'clicked'} state - 검사할 상태 이름입니다.
     * @param {{includeConsumed?: boolean}} [options={}] - 소비된 상태 포함 여부 옵션입니다.
     * @returns {boolean} 상태 활성 여부입니다.
     */
    hasButtonState(buttonName, state, options = {}) {
        return this.buttonStateMachine.hasButtonState(buttonName, state, options);
    }

    /**
     * 지정한 버튼의 단발성 상태를 소비 처리합니다.
     * 현재는 `clicked` 상태만 소비 대상으로 지원합니다.
     * @param {'left'|'right'|'middle'} buttonName - 소비할 버튼 이름입니다.
     * @param {'clicked'} [state='clicked'] - 소비할 상태 이름입니다.
     * @returns {boolean} 실제로 소비되었으면 true를 반환합니다.
     */
    consumeButtonState(buttonName, state = 'clicked') {
        return this.buttonStateMachine.consumeButtonState(buttonName, state);
    }

    /**
     * 마우스 포커스 레이어를 설정합니다. (기존 포커스 리스트 초기화)
     * @param {string} focus - 포커스 레이어
     */
    setFocus(focus) {
        this.focusList = Array.isArray(focus) ? [...focus] : [focus];
    }

    /**
     * 마우스 포커스 레이어를 추가합니다.
     * @param {string} focus - 포커스 레이어
     */
    addFocus(focus) {
        if (this.focusList.includes(focus)) {
            // 이미 있으면 제거 후 다시 추가 (맨 위로 이동)
            this.removeFocus(focus);
        }
        this.focusList.push(focus);
    }

    /**
     * 마우스 포커스 레이어를 제거합니다.
     * @param {string} focus - 포커스 레이어
     */
    removeFocus(focus) {
        const index = this.focusList.indexOf(focus);
        if (index > -1) {
            this.focusList.splice(index, 1);
        }
    }

    /**
     * 현재 마우스 포커스 (최상위)를 반환합니다.
     * @returns {string} 포커스 레이어 이름
     */
    get focus() {
        if (this.focusList.length === 0) return 'none';
        return this.focusList[this.focusList.length - 1];
    }
}

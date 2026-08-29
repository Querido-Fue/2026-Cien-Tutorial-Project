import { PointerLockExitIntentDetector } from './_pointer_lock_exit_intent_detector.js';

/**
 * 포인터 잠금 상태 변경을 엔진 앱에 알리는 DOM 이벤트 이름입니다.
 * @type {string}
 */
export const POINTER_LOCK_STATE_EVENT = 'engine-pointer-lock-state-change';

/**
 * 화면 이탈 의도 안내 상태 변경을 엔진 앱에 알리는 DOM 이벤트 이름입니다.
 * @type {string}
 */
export const POINTER_LOCK_EXIT_HINT_EVENT = 'engine-pointer-lock-exit-hint-change';

const PRIMARY_BUTTON = 0;
const MIDDLE_BUTTON = 1;
const ESCAPE_CODE = 'Escape';
const CLICK_SUPPRESSION_MILLISECONDS = 1000;

/**
 * @class PointerLockInputHandler
 * @description 포인터 잠금 획득·해제와 재포커스 입력 차단을 소유합니다.
 */
export class PointerLockInputHandler {
    #document;
    #window;
    #target;
    #enabled;
    #supported;
    #acquiring;
    #hasEverLocked;
    #suppressedPrimaryButton;
    #suppressClickUntil;
    #suppressEscapeUntilKeyup;
    #activationPosition;
    #inputResetCallback;
    #lockAcquiredCallback;
    #activationBypassCallback;
    #exitIntentDetector;
    #boundPointerLockChange;
    #boundPointerLockError;
    #boundMouseDown;
    #boundMouseUp;
    #boundClick;
    #boundAuxClick;
    #boundContextMenu;
    #boundKeyDown;
    #boundKeyUp;
    #boundWindowBlur;

    /**
     * @param {{documentRef?:Document|null,windowRef?:Window|null}} [options={}] - 테스트 가능한 DOM 포트입니다.
     */
    constructor(options = {}) {
        this.#document = options.documentRef ?? globalThis.document ?? null;
        this.#window = options.windowRef ?? globalThis.window ?? null;
        this.#target = this.#document?.documentElement || null;
        this.#enabled = false;
        this.#supported = typeof this.#target?.requestPointerLock === 'function'
            && typeof this.#document?.exitPointerLock === 'function';
        this.#acquiring = false;
        this.#hasEverLocked = false;
        this.#suppressedPrimaryButton = false;
        this.#suppressClickUntil = 0;
        this.#suppressEscapeUntilKeyup = false;
        this.#activationPosition = null;
        this.#inputResetCallback = null;
        this.#lockAcquiredCallback = null;
        this.#activationBypassCallback = null;
        this.#exitIntentDetector = new PointerLockExitIntentDetector({
            onChange: (snapshot) => this.#emitExitHintChange(snapshot)
        });

        this.#boundPointerLockChange = this.#handlePointerLockChange.bind(this);
        this.#boundPointerLockError = this.#handlePointerLockError.bind(this);
        this.#boundMouseDown = this.#handleMouseDown.bind(this);
        this.#boundMouseUp = this.#handleMouseUp.bind(this);
        this.#boundClick = this.#handleClick.bind(this);
        this.#boundAuxClick = this.#handleAuxClick.bind(this);
        this.#boundContextMenu = this.#handleContextMenu.bind(this);
        this.#boundKeyDown = this.#handleKeyDown.bind(this);
        this.#boundKeyUp = this.#handleKeyUp.bind(this);
        this.#boundWindowBlur = this.#handleWindowBlur.bind(this);
        this.#attachListeners();
    }

    /** @param {Function|null} callback - 잠금 경계에서 입력을 초기화할 콜백입니다. */
    setInputResetCallback(callback) {
        this.#inputResetCallback = typeof callback === 'function' ? callback : null;
    }

    /** @param {Function|null} callback - 잠금 획득 위치를 동기화할 콜백입니다. */
    setLockAcquiredCallback(callback) {
        this.#lockAcquiredCallback = typeof callback === 'function' ? callback : null;
    }

    /**
     * 엔진 오버레이가 입력 우선권을 가진 동안 재잠금을 건너뛸 판정기를 설정합니다.
     * @param {Function|null} callback - true이면 현재 클릭을 그대로 전파합니다.
     */
    setActivationBypassCallback(callback) {
        this.#activationBypassCallback = typeof callback === 'function'
            ? callback
            : null;
    }

    /**
     * 포인터 잠금 기본 정책을 켜거나 끕니다.
     * 활성화 직후에는 브라우저 보안 정책에 따라 첫 사용자 클릭을 기다립니다.
     * @param {boolean} enabled - 활성화 여부입니다.
     */
    setEnabled(enabled) {
        const nextEnabled = enabled === true && this.#supported;
        if (this.#enabled === nextEnabled) {
            return;
        }
        this.#enabled = nextEnabled;
        this.#acquiring = false;
        this.#clearSuppressionState();
        if (!nextEnabled) {
            this.#exitIntentDetector.reset();
        }
        if (!nextEnabled && this.#document?.pointerLockElement === this.#target) {
            this.#document.exitPointerLock();
        }
        this.#emitStateChange();
    }

    /** @returns {boolean} 현재 게임 포인터가 잠겨 있는지 여부입니다. */
    isLocked() {
        return this.#enabled
            && this.#document?.pointerLockElement === this.#target;
    }

    /**
     * 현재 포인터 잠금 상태를 방어 복제합니다.
     * @returns {{enabled:boolean,supported:boolean,locked:boolean,acquiring:boolean,awaitingActivation:boolean,hasEverLocked:boolean,initialActivationPending:boolean,exitHint:Readonly<object>}}
     */
    getSnapshot() {
        const locked = this.isLocked();
        return Object.freeze({
            enabled: this.#enabled,
            supported: this.#supported,
            locked,
            acquiring: this.#acquiring,
            awaitingActivation: this.#enabled && !locked,
            hasEverLocked: this.#hasEverLocked,
            initialActivationPending: this.#enabled && !locked && !this.#hasEverLocked,
            exitHint: this.#exitIntentDetector.getSnapshot()
        });
    }

    /**
     * 잠금 중 원시 상대 이동을 화면 이탈 의도 판정기에 전달합니다.
     * @param {object} sample - 가상 커서와 상대 이동 좌표입니다.
     */
    recordPointerMovement(sample = {}) {
        this.#exitIntentDetector.record({
            ...sample,
            locked: this.isLocked(),
            timeMilliseconds: this.#getNowMilliseconds()
        });
    }

    /** 상대 이동이 멎은 프레임에도 연속 이동 조건을 갱신합니다. */
    update() {
        if (!this.isLocked()) {
            this.#exitIntentDetector.reset();
            return;
        }
        this.#exitIntentDetector.update(this.#getNowMilliseconds());
    }

    /** DOM 이벤트 리스너를 해제하고 소유한 잠금을 반환합니다. */
    destroy() {
        this.setEnabled(false);
        this.#document?.removeEventListener?.(
            'pointerlockchange',
            this.#boundPointerLockChange
        );
        this.#document?.removeEventListener?.(
            'pointerlockerror',
            this.#boundPointerLockError
        );
        this.#document?.removeEventListener?.('mousedown', this.#boundMouseDown, true);
        this.#document?.removeEventListener?.('mouseup', this.#boundMouseUp, true);
        this.#document?.removeEventListener?.('click', this.#boundClick, true);
        this.#document?.removeEventListener?.('auxclick', this.#boundAuxClick, true);
        this.#document?.removeEventListener?.('contextmenu', this.#boundContextMenu, true);
        this.#window?.removeEventListener?.('keydown', this.#boundKeyDown, true);
        this.#window?.removeEventListener?.('keyup', this.#boundKeyUp, true);
        this.#window?.removeEventListener?.('blur', this.#boundWindowBlur);
        this.#exitIntentDetector.destroy();
        this.#inputResetCallback = null;
        this.#lockAcquiredCallback = null;
        this.#activationBypassCallback = null;
    }

    /** @private */
    #attachListeners() {
        this.#document?.addEventListener?.(
            'pointerlockchange',
            this.#boundPointerLockChange
        );
        this.#document?.addEventListener?.(
            'pointerlockerror',
            this.#boundPointerLockError
        );
        this.#document?.addEventListener?.('mousedown', this.#boundMouseDown, true);
        this.#document?.addEventListener?.('mouseup', this.#boundMouseUp, true);
        this.#document?.addEventListener?.('click', this.#boundClick, true);
        this.#document?.addEventListener?.('auxclick', this.#boundAuxClick, true);
        this.#document?.addEventListener?.('contextmenu', this.#boundContextMenu, true);
        this.#window?.addEventListener?.('keydown', this.#boundKeyDown, true);
        this.#window?.addEventListener?.('keyup', this.#boundKeyUp, true);
        this.#window?.addEventListener?.('blur', this.#boundWindowBlur);
    }

    /** @param {MouseEvent} event @private */
    #handleMouseDown(event) {
        if (!this.#enabled || Number(event?.button) !== PRIMARY_BUTTON) {
            return;
        }
        if (this.isLocked()) {
            // 재잠금 직후 브라우저가 원래 mouseup을 생략했더라도 다음 실제 클릭은 살립니다.
            this.#suppressedPrimaryButton = false;
            this.#suppressClickUntil = 0;
            return;
        }
        if (this.#shouldBypassActivation()) {
            this.#clearSuppressionState();
            return;
        }
        this.#activationPosition = Object.freeze({
            clientX: Number(event?.clientX) || 0,
            clientY: Number(event?.clientY) || 0
        });
        this.#suppressedPrimaryButton = true;
        this.#suppressClickUntil = Date.now() + CLICK_SUPPRESSION_MILLISECONDS;
        this.#consumeDomEvent(event);
        this.#requestLock();
    }

    /** @param {MouseEvent} event @private */
    #handleMouseUp(event) {
        if (!this.#suppressedPrimaryButton || Number(event?.button) !== PRIMARY_BUTTON) {
            return;
        }
        this.#consumeDomEvent(event);
        this.#suppressedPrimaryButton = false;
    }

    /** @param {MouseEvent} event @private */
    #handleClick(event) {
        if (Number(event?.button) !== PRIMARY_BUTTON
            || Date.now() > this.#suppressClickUntil) {
            return;
        }
        this.#consumeDomEvent(event);
        this.#suppressClickUntil = 0;
    }

    /** @param {MouseEvent} event @private */
    #handleAuxClick(event) {
        if (this.#enabled && this.isLocked() && Number(event?.button) === MIDDLE_BUTTON) {
            event?.preventDefault?.();
        }
    }

    /** @param {MouseEvent} event @private */
    #handleContextMenu(event) {
        if (this.#enabled && this.isLocked()) {
            event?.preventDefault?.();
        }
    }

    /** @param {KeyboardEvent} event @private */
    #handleKeyDown(event) {
        if (event?.code !== ESCAPE_CODE || !this.isLocked()) {
            return;
        }
        this.#suppressEscapeUntilKeyup = true;
        this.#consumeDomEvent(event);
        this.#document?.exitPointerLock?.();
    }

    /** @param {KeyboardEvent} event @private */
    #handleKeyUp(event) {
        if (event?.code !== ESCAPE_CODE || !this.#suppressEscapeUntilKeyup) {
            return;
        }
        this.#consumeDomEvent(event);
        this.#suppressEscapeUntilKeyup = false;
    }

    /** @private */
    #handleWindowBlur() {
        this.#clearSuppressionState();
        this.#exitIntentDetector.reset();
    }

    /** @private */
    #requestLock() {
        if (!this.#enabled || !this.#supported || this.#acquiring || this.isLocked()) {
            return;
        }
        this.#acquiring = true;
        this.#emitStateChange();
        try {
            const result = this.#target.requestPointerLock();
            if (result && typeof result.catch === 'function') {
                result.catch(() => this.#handlePointerLockError());
            }
        } catch (_error) {
            this.#handlePointerLockError();
        }
    }

    /** @private */
    #handlePointerLockChange() {
        const locked = this.isLocked();
        this.#acquiring = false;
        if (locked) {
            this.#hasEverLocked = true;
        } else {
            this.#exitIntentDetector.reset();
        }
        if (locked && this.#activationPosition && this.#lockAcquiredCallback) {
            this.#lockAcquiredCallback(this.#activationPosition);
        }
        this.#inputResetCallback?.();
        this.#emitStateChange();
    }

    /** @private */
    #handlePointerLockError() {
        if (!this.#acquiring) {
            return;
        }
        this.#acquiring = false;
        this.#activationPosition = null;
        this.#emitStateChange();
    }

    /** @private */
    #clearSuppressionState() {
        this.#suppressedPrimaryButton = false;
        this.#suppressClickUntil = 0;
        this.#suppressEscapeUntilKeyup = false;
    }

    /** @param {Event} event @private */
    #consumeDomEvent(event) {
        event?.preventDefault?.();
        event?.stopImmediatePropagation?.();
    }

    /** @returns {boolean} 엔진 입력 계층이 현재 클릭을 우선 소비하는지 여부입니다. @private */
    #shouldBypassActivation() {
        if (!this.#activationBypassCallback) {
            return false;
        }
        try {
            return this.#activationBypassCallback() === true;
        } catch (_error) {
            return false;
        }
    }

    /** @private */
    #emitStateChange() {
        const EventConstructor = this.#window?.CustomEvent
            || globalThis.CustomEvent;
        if (!this.#window?.dispatchEvent || typeof EventConstructor !== 'function') {
            return;
        }
        this.#window.dispatchEvent(new EventConstructor(POINTER_LOCK_STATE_EVENT, {
            detail: this.getSnapshot()
        }));
    }

    /** @returns {number} 동일 시간축의 현재 밀리초입니다. @private */
    #getNowMilliseconds() {
        const performanceNow = this.#window?.performance?.now?.()
            ?? globalThis.performance?.now?.();
        const now = Number(performanceNow);
        return Number.isFinite(now) ? now : Date.now();
    }

    /** @param {Readonly<object>} snapshot @private */
    #emitExitHintChange(snapshot) {
        const EventConstructor = this.#window?.CustomEvent
            || globalThis.CustomEvent;
        if (!this.#window?.dispatchEvent || typeof EventConstructor !== 'function') {
            return;
        }
        this.#window.dispatchEvent(new EventConstructor(POINTER_LOCK_EXIT_HINT_EVENT, {
            detail: snapshot
        }));
    }
}

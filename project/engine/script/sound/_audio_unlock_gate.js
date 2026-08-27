/**
 * @class AudioUnlockGate
 * @description 자동재생 차단 뒤 최초 사용자 상호작용 리스너의 수명만 관리합니다.
 */
export class AudioUnlockGate {
    #target;
    #events;
    #onUnlock;
    #handler;
    #armed;

    /** @param {{target?:object,events?:readonly string[],onUnlock?:Function}} options */
    constructor({ target = null, events = [], onUnlock = () => true } = {}) {
        this.#target = target;
        this.#events = [...events];
        this.#onUnlock = onUnlock;
        this.#handler = this.#handleUnlock.bind(this);
        this.#armed = false;
    }

    /** 사용자 입력 재시도를 한 번만 대기합니다. */
    arm() {
        if (this.#armed || !this.#target?.addEventListener) {
            return;
        }
        for (const eventName of this.#events) {
            this.#target.addEventListener(eventName, this.#handler, { once: true });
        }
        this.#armed = true;
    }

    /** 등록된 모든 입력 리스너를 제거합니다. */
    disarm() {
        if (!this.#armed || !this.#target?.removeEventListener) {
            this.#armed = false;
            return;
        }
        for (const eventName of this.#events) {
            this.#target.removeEventListener(eventName, this.#handler);
        }
        this.#armed = false;
    }

    /** 수명 종료 시 외부 참조와 리스너를 정리합니다. */
    destroy() {
        this.disarm();
        this.#target = null;
        this.#onUnlock = () => true;
    }

    /** @private */
    async #handleUnlock() {
        this.disarm();
        try {
            const unlocked = await this.#onUnlock();
            if (unlocked === false) {
                this.arm();
            }
        } catch {
            this.arm();
        }
    }
}

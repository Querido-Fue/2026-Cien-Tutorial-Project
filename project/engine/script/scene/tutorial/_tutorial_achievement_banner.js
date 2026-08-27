/**
 * @class TutorialAchievementBanner
 * @description 판정이 끝난 업적 알림의 중복 제거, 표시 수명과 순서만 관리합니다.
 */
export class TutorialAchievementBanner {
    #durationSeconds;
    #queue;
    #current;
    #elapsedSeconds;
    #seenKeys;

    /** @param {{durationSeconds?:number}} options - 알림 표시 시간입니다. */
    constructor({ durationSeconds = 3 } = {}) {
        this.#durationSeconds = Math.max(0.1, Number(durationSeconds) || 3);
        this.#queue = [];
        this.#current = null;
        this.#elapsedSeconds = 0;
        this.#seenKeys = new Set();
    }

    /**
     * 판정 계층이 만든 알림을 세션 대기열에 추가합니다.
     * @param {readonly object[]} notifications - key, title, detail을 가진 알림입니다.
     * @returns {number} 새로 대기열에 추가된 알림 수입니다.
     */
    enqueue(notifications) {
        let addedCount = 0;
        for (const notification of Array.isArray(notifications) ? notifications : []) {
            const key = typeof notification?.key === 'string'
                ? notification.key.trim()
                : '';
            if (!key
                || typeof notification.title !== 'string'
                || typeof notification.detail !== 'string') {
                continue;
            }
            if (this.#seenKeys.has(key)) {
                continue;
            }
            this.#seenKeys.add(key);
            this.#queue.push(Object.freeze({
                key,
                title: notification.title,
                detail: notification.detail
            }));
            addedCount += 1;
        }
        this.#showNextIfIdle();
        return addedCount;
    }

    /** @param {number} deltaSeconds - 경과 초입니다. */
    update(deltaSeconds) {
        if (!this.#current) {
            this.#showNextIfIdle();
            return;
        }
        this.#elapsedSeconds += Math.max(0, Number(deltaSeconds) || 0);
        if (this.#elapsedSeconds >= this.#durationSeconds) {
            this.#current = null;
            this.#elapsedSeconds = 0;
            this.#showNextIfIdle();
        }
    }

    /** @returns {Readonly<object>} 현재 표시 상태입니다. */
    getSnapshot() {
        return Object.freeze({
            visible: Boolean(this.#current),
            title: this.#current?.title || '',
            detail: this.#current?.detail || '',
            progress: this.#current
                ? Math.min(1, this.#elapsedSeconds / this.#durationSeconds)
                : 0
        });
    }

    /** 새 런 또는 이탈 시 알림과 중복 기록을 초기화합니다. */
    clear() {
        this.#queue = [];
        this.#current = null;
        this.#elapsedSeconds = 0;
        this.#seenKeys.clear();
    }

    /** 소유 상태를 정리합니다. */
    destroy() {
        this.clear();
    }

    /** @private */
    #showNextIfIdle() {
        if (!this.#current && this.#queue.length > 0) {
            this.#current = this.#queue.shift();
            this.#elapsedSeconds = 0;
        }
    }
}

/**
 * @class TutorialAchievementBanner
 * @description 명시된 업적 규칙이 생기기 전까지 한 런의 최초 발견 알림 수명과 순서를 관리합니다.
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
     * 모델 이벤트에서 세션 한정 발견 알림을 구성합니다.
     * @param {readonly object[]} events - 모델 결과 이벤트입니다.
     * @param {object} items - 아이템 메타데이터입니다.
     * @returns {number} 새로 대기열에 추가된 알림 수입니다.
     */
    enqueueFromEvents(events, items = {}) {
        let addedCount = 0;
        for (const event of Array.isArray(events) ? events : []) {
            if (event?.type !== 'item-picked' || typeof event.itemId !== 'string') {
                continue;
            }
            const key = 'item:' + event.itemId;
            if (this.#seenKeys.has(key)) {
                continue;
            }
            this.#seenKeys.add(key);
            this.#queue.push(Object.freeze({
                key,
                title: '발견 업적',
                detail: (items[event.itemId]?.label || event.itemId) + ' 발견'
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

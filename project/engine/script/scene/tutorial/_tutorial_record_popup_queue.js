/**
 * @class TutorialRecordPopupQueue
 * @description 한 이동 경로에서 여러 기록을 획득해도 팝업을 순서대로 소비합니다.
 */
export class TutorialRecordPopupQueue {
    #pendingIds = [];
    #activeId = null;

    /**
     * 유효한 기록 ID를 최초 등장 순서로 대기열에 추가합니다.
     * @param {readonly *[]} ids - 획득 사건에서 얻은 기록 ID입니다.
     * @returns {number} 새로 추가한 ID 수입니다.
     */
    enqueue(ids = []) {
        let added = 0;
        for (const candidate of Array.isArray(ids) ? ids : []) {
            const id = typeof candidate === 'string' ? candidate.trim() : '';
            if (!id || id === this.#activeId || this.#pendingIds.includes(id)) {
                continue;
            }
            this.#pendingIds.push(id);
            added += 1;
        }
        return added;
    }

    /** @returns {string|null} 현재 항목 또는 다음 대기 항목입니다. */
    openNext() {
        if (!this.#activeId) {
            this.#activeId = this.#pendingIds.shift() || null;
        }
        return this.#activeId;
    }

    /** @returns {string|null} 닫은 활성 항목 ID입니다. */
    closeActive() {
        const closedId = this.#activeId;
        this.#activeId = null;
        return closedId;
    }

    /** @returns {string|null} 현재 표시 중인 기록 ID입니다. */
    getActiveId() {
        return this.#activeId;
    }

    /** @returns {boolean} 활성 또는 대기 팝업이 있는지 여부입니다. */
    hasWork() {
        return Boolean(this.#activeId || this.#pendingIds.length > 0);
    }

    /** 런 이탈에서 활성·대기 항목을 모두 정리합니다. */
    clear() {
        this.#activeId = null;
        this.#pendingIds = [];
    }
}

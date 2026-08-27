/**
 * @class TutorialBattleFocusController
 * @description 전투 버튼의 키보드·포인터 공통 선택 키만 관리합니다.
 */
export class TutorialBattleFocusController {
    #keys;
    #focusedKey;

    constructor() {
        this.#keys = [];
        this.#focusedKey = null;
    }

    /**
     * 현재 화면에서 조사할 수 있는 키 목록을 교체합니다.
     * @param {string[]} keys - 순환 순서대로 정렬된 버튼 키입니다.
     */
    setKeys(keys) {
        this.#keys = [...new Set(
            (Array.isArray(keys) ? keys : [])
                .filter((key) => typeof key === 'string' && key.length > 0)
        )];
        if (!this.#keys.includes(this.#focusedKey)) {
            this.#focusedKey = null;
        }
    }

    /**
     * 포인터 또는 직접 선택으로 특정 키에 포커스를 둡니다.
     * @param {string} key - 버튼 키입니다.
     * @returns {boolean} 포커스가 달라졌는지 여부입니다.
     */
    focus(key) {
        if (!this.#keys.includes(key) || this.#focusedKey === key) {
            return false;
        }
        this.#focusedKey = key;
        return true;
    }

    /**
     * 현재 목록에서 포커스를 순환합니다.
     * @param {number} delta - 이동 방향입니다.
     * @returns {string|null} 이동 후 포커스 키입니다.
     */
    shift(delta = 1) {
        if (this.#keys.length === 0 || Number(delta) === 0) {
            return this.#focusedKey;
        }
        const currentIndex = this.#keys.indexOf(this.#focusedKey);
        const startIndex = currentIndex < 0
            ? (Number(delta) > 0 ? -1 : 0)
            : currentIndex;
        const nextIndex = (
            startIndex + Math.sign(Number(delta)) + this.#keys.length
        ) % this.#keys.length;
        this.#focusedKey = this.#keys[nextIndex];
        return this.#focusedKey;
    }

    /** @returns {string|null} 현재 공통 포커스 키입니다. */
    getFocusedKey() {
        return this.#focusedKey;
    }

    /** 전투 전환 시 포커스 상태를 비웁니다. */
    reset() {
        this.#keys = [];
        this.#focusedKey = null;
    }
}

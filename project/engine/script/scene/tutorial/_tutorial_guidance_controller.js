/**
 * @class TutorialGuidanceController
 * @description 첫 플레이 자동 안내와 재플레이 수동 열기 상태만 소유합니다.
 */
export class TutorialGuidanceController {
    #open;

    constructor() {
        this.#open = false;
    }

    /**
     * 새 전투에서 메타 진행도에 따라 안내 표시 여부를 정합니다.
     * @param {{seen?:boolean}} policy - 저장된 안내 확인 정책입니다.
     */
    beginRun(policy = {}) {
        this.#open = policy.seen !== true;
    }

    /** 사용자가 요청한 짧은 안내를 엽니다. */
    show() {
        this.#open = true;
    }

    /**
     * 현재 안내를 닫습니다.
     * @returns {boolean} 열린 안내가 닫혔는지 여부입니다.
     */
    dismiss() {
        if (!this.#open) {
            return false;
        }
        this.#open = false;
        return true;
    }

    /** @returns {boolean} 안내가 열려 있는지 여부입니다. */
    isOpen() {
        return this.#open;
    }

    /** 런 이탈 시 표시 상태를 비웁니다. */
    reset() {
        this.#open = false;
    }
}

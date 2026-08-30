/**
 * @class TutorialLongPressController
 * @description 버튼 재생성 경계를 넘어 단일 포인터 롱프레스와 릴리스 클릭 억제를 관리합니다.
 */
export class TutorialLongPressController {
    #activeKey;
    #requiredSeconds;
    #startedAtSeconds;
    #suppressActivation;

    constructor() {
        this.reset();
    }

    /**
     * 현재 프레임 입력을 누적하고 임계시간에 도달한 버튼 키를 한 번만 반환합니다.
     * @param {object} input - 포인터와 호버 대상 상태입니다.
     * @param {boolean} [input.pressStarted=false] - 이번 프레임에 누르기 시작했는지 여부입니다.
     * @param {boolean} [input.pressing=false] - 현재 누르고 있는지 여부입니다.
     * @param {boolean} [input.released=false] - 이번 프레임에 놓았는지 여부입니다.
     * @param {{key:string,durationSeconds:number}|null} [input.hoveredTarget=null] - 현재 호버한 롱프레스 대상입니다.
     * @param {number} [input.timestampSeconds=0] - 현재 단조 시각입니다.
     * @returns {string|null} 롱프레스가 완료된 버튼 키입니다.
     */
    update({
        pressStarted = false,
        pressing = false,
        released = false,
        hoveredTarget = null,
        timestampSeconds = 0
    } = {}) {
        if (this.#suppressActivation) {
            return null;
        }

        const target = this.#normalizeTarget(hoveredTarget);
        if (pressStarted) {
            this.#begin(target, timestampSeconds);
        }
        if (!this.#activeKey) {
            return null;
        }
        if ((!pressing && !released) || target?.key !== this.#activeKey) {
            this.#clearTracking();
            return null;
        }

        const elapsedSeconds = Math.max(
            0,
            (Number(timestampSeconds) || 0) - this.#startedAtSeconds
        );
        if (elapsedSeconds < this.#requiredSeconds) {
            if (released) {
                this.#clearTracking();
            }
            return null;
        }

        const triggeredKey = this.#activeKey;
        this.#clearTracking();
        this.#suppressActivation = true;
        return triggeredKey;
    }

    /** @returns {boolean} 현재 누름의 일반 클릭을 억제해야 하는지 여부입니다. */
    shouldSuppressActivation() {
        return this.#suppressActivation;
    }

    /**
     * 버튼 갱신이 끝난 뒤 릴리스 프레임의 클릭 억제를 해제합니다.
     * @param {{pressing?:boolean}} [input={}] - 현재 포인터 누름 상태입니다.
     */
    completeFrame({ pressing = false } = {}) {
        if (!pressing) {
            this.#suppressActivation = false;
            this.#clearTracking();
        }
    }

    /** 진행 중인 제스처와 클릭 억제를 모두 초기화합니다. */
    reset() {
        this.#activeKey = null;
        this.#requiredSeconds = 0;
        this.#startedAtSeconds = 0;
        this.#suppressActivation = false;
    }

    /**
     * @param {{key:string,durationSeconds:number}|null} target - 시작 대상입니다.
     * @param {number} timestampSeconds - 누르기 시작을 관측한 단조 시각입니다.
     * @private
     */
    #begin(target, timestampSeconds) {
        this.#clearTracking();
        if (!target) {
            return;
        }
        this.#activeKey = target.key;
        this.#requiredSeconds = target.durationSeconds;
        this.#startedAtSeconds = Number(timestampSeconds) || 0;
    }

    /** 추적 중인 버튼과 누적 시간만 초기화합니다. @private */
    #clearTracking() {
        this.#activeKey = null;
        this.#requiredSeconds = 0;
        this.#startedAtSeconds = 0;
    }

    /**
     * 유효한 버튼 키와 양수 임계시간만 롱프레스 대상으로 정규화합니다.
     * @param {*} target - 정규화할 대상입니다.
     * @returns {{key:string,durationSeconds:number}|null} 정규화된 대상입니다.
     * @private
     */
    #normalizeTarget(target) {
        const key = typeof target?.key === 'string' ? target.key : '';
        const durationSeconds = Number(target?.durationSeconds);
        if (!key || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
            return null;
        }
        return { key, durationSeconds };
    }
}

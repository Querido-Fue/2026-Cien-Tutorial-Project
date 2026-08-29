const CAMERA_EPSILON = 0.0001;

/**
 * 카메라가 추적할 유효한 타일 좌표를 복제합니다.
 * @param {*} value - 좌표 후보입니다.
 * @returns {{x:number,y:number}|null} 유효 좌표입니다.
 */
function cloneCameraTarget(value) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/**
 * @class TutorialBattleCamera
 * @description 플레이어 표시 좌표를 프레임 독립적인 easeOutExpo 감쇠로 추적합니다.
 */
export class TutorialBattleCamera {
    #durationSeconds;
    #x;
    #y;
    #floorIndex;
    #initialized;

    /**
     * @param {object} options - 카메라 추적 시간 설정입니다.
     * @param {number} [options.durationSeconds=0.3] - 목표에 수렴할 기준 시간입니다.
     */
    constructor({ durationSeconds = 0.3 } = {}) {
        this.#durationSeconds = Math.max(0, Number(durationSeconds) || 0);
        this.#x = 0;
        this.#y = 0;
        this.#floorIndex = 0;
        this.#initialized = false;
    }

    /**
     * 새 런 또는 새 층의 플레이어 위치로 카메라를 즉시 맞춥니다.
     * @param {object} target - 타일 좌표와 층 번호입니다.
     * @returns {Readonly<object>} 초기화된 카메라 스냅샷입니다.
     */
    reset(target = {}) {
        const tile = cloneCameraTarget(target);
        if (!tile) {
            this.clear();
            return this.getSnapshot();
        }
        this.#x = tile.x;
        this.#y = tile.y;
        this.#floorIndex = Number(target.floorIndex) || 0;
        this.#initialized = true;
        return this.getSnapshot();
    }

    /** 카메라가 다음 런에서 첫 좌표로 즉시 초기화되도록 비웁니다. */
    clear() {
        this.#x = 0;
        this.#y = 0;
        this.#floorIndex = 0;
        this.#initialized = false;
    }

    /**
     * 현재 플레이어 표시 좌표를 0.3초 easeOutExpo 감쇠로 추적합니다.
     * 가변 프레임에서도 추적 속도 차이가 작도록 델타 기반 지수 감쇠를 사용합니다.
     * @param {object} options - 목표 좌표, 표시 층과 프레임 델타입니다.
     * @returns {Readonly<object>} 갱신된 카메라 스냅샷입니다.
     */
    update({ target, floorIndex = 0, deltaSeconds = 0 } = {}) {
        const tile = cloneCameraTarget(target);
        if (!tile) {
            return this.getSnapshot();
        }
        const nextFloorIndex = Number(floorIndex) || 0;
        if (!this.#initialized || nextFloorIndex !== this.#floorIndex) {
            return this.reset({ ...tile, floorIndex: nextFloorIndex });
        }
        const delta = Math.max(0, Number(deltaSeconds) || 0);
        if (this.#durationSeconds <= 0 || delta >= this.#durationSeconds) {
            this.#x = tile.x;
            this.#y = tile.y;
            return this.getSnapshot();
        }
        const normalizedTime = delta / this.#durationSeconds;
        const blend = normalizedTime > 0
            ? 1 - Math.pow(2, -10 * normalizedTime)
            : 0;
        this.#x += (tile.x - this.#x) * blend;
        this.#y += (tile.y - this.#y) * blend;
        if (Math.abs(tile.x - this.#x) <= CAMERA_EPSILON) {
            this.#x = tile.x;
        }
        if (Math.abs(tile.y - this.#y) <= CAMERA_EPSILON) {
            this.#y = tile.y;
        }
        return this.getSnapshot();
    }

    /** @returns {Readonly<{x:number,y:number,floorIndex:number,initialized:boolean}>} 현재 카메라 상태입니다. */
    getSnapshot() {
        return Object.freeze({
            x: this.#x,
            y: this.#y,
            floorIndex: this.#floorIndex,
            initialized: this.#initialized
        });
    }

    /** 소유 상태를 정리합니다. */
    destroy() {
        this.clear();
    }
}

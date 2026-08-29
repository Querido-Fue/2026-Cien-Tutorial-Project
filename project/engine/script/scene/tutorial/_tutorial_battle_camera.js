const CAMERA_EPSILON = 0.0001;
const ZOOM_EPSILON = 0.000001;

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
 * @description 플레이어 표시 좌표 추적과 연속 retarget 가능한 easeOutExpo 줌을 소유합니다.
 */
export class TutorialBattleCamera {
    #durationSeconds;
    #zoomDurationSeconds;
    #defaultZoom;
    #x;
    #y;
    #zoom;
    #zoomStart;
    #zoomTarget;
    #zoomElapsedSeconds;
    #floorIndex;
    #initialized;

    /**
     * @param {object} options - 카메라 추적 시간 설정입니다.
     * @param {number} [options.durationSeconds=0.3] - 목표에 수렴할 기준 시간입니다.
     * @param {number} [options.zoomDurationSeconds=0.4] - 줌 easeOutExpo 시간입니다.
     * @param {number} [options.defaultZoom=1] - 새 런의 기본 줌입니다.
     */
    constructor({
        durationSeconds = 0.3,
        zoomDurationSeconds = 0.4,
        defaultZoom = 1
    } = {}) {
        this.#durationSeconds = Math.max(0, Number(durationSeconds) || 0);
        this.#zoomDurationSeconds = Math.max(
            0,
            Number(zoomDurationSeconds) || 0
        );
        this.#defaultZoom = Math.max(0.01, Number(defaultZoom) || 1);
        this.#x = 0;
        this.#y = 0;
        this.#zoom = this.#defaultZoom;
        this.#zoomStart = this.#defaultZoom;
        this.#zoomTarget = this.#defaultZoom;
        this.#zoomElapsedSeconds = 0;
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
        const requestedZoom = Number(target.zoom);
        this.#zoom = Number.isFinite(requestedZoom) && requestedZoom > 0
            ? requestedZoom
            : this.#defaultZoom;
        this.#zoomStart = this.#zoom;
        this.#zoomTarget = this.#zoom;
        this.#zoomElapsedSeconds = this.#zoomDurationSeconds;
        this.#floorIndex = Number(target.floorIndex) || 0;
        this.#initialized = true;
        return this.getSnapshot();
    }

    /** 카메라가 다음 런에서 첫 좌표로 즉시 초기화되도록 비웁니다. */
    clear() {
        this.#x = 0;
        this.#y = 0;
        this.#zoom = this.#defaultZoom;
        this.#zoomStart = this.#defaultZoom;
        this.#zoomTarget = this.#defaultZoom;
        this.#zoomElapsedSeconds = 0;
        this.#floorIndex = 0;
        this.#initialized = false;
    }

    /**
     * 현재 플레이어 표시 좌표를 0.3초 easeOutExpo 감쇠로 추적하고 줌을 보간합니다.
     * 좌표 추적은 델타 기반 감쇠를, 줌은 현재값에서 재지정되는 명시적 시간축을 사용합니다.
     * @param {object} options - 목표 좌표, 표시 층과 프레임 델타입니다.
     * @returns {Readonly<object>} 갱신된 카메라 스냅샷입니다.
     */
    update({
        target,
        floorIndex = 0,
        deltaSeconds = 0,
        zoomTarget = this.#zoomTarget
    } = {}) {
        const tile = cloneCameraTarget(target);
        if (!tile) {
            return this.getSnapshot();
        }
        const nextFloorIndex = Number(floorIndex) || 0;
        if (!this.#initialized) {
            return this.reset({
                ...tile,
                floorIndex: nextFloorIndex,
                zoom: zoomTarget
            });
        }
        if (nextFloorIndex !== this.#floorIndex) {
            this.#x = tile.x;
            this.#y = tile.y;
            this.#floorIndex = nextFloorIndex;
        }
        const delta = Math.max(0, Number(deltaSeconds) || 0);
        if (this.#durationSeconds <= 0 || delta >= this.#durationSeconds) {
            this.#x = tile.x;
            this.#y = tile.y;
        } else {
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
        }
        this.#retargetZoom(zoomTarget);
        this.#advanceZoom(delta);
        return this.getSnapshot();
    }

    /**
     * 연속 휠 입력의 최신 목표를 현재 표시 배율에서 다시 시작합니다.
     * @param {*} value - 새 목표 배율입니다.
     * @returns {boolean} 목표가 실제로 바뀌었는지 여부입니다.
     * @private
     */
    #retargetZoom(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)
            || numeric <= 0
            || Math.abs(numeric - this.#zoomTarget) <= ZOOM_EPSILON) {
            return false;
        }
        this.#zoomStart = this.#zoom;
        this.#zoomTarget = numeric;
        this.#zoomElapsedSeconds = 0;
        return true;
    }

    /**
     * 현재 줌 애니메이션을 표준 easeOutExpo 곡선으로 진행합니다.
     * @param {number} deltaSeconds - 가변 프레임 델타입니다.
     * @private
     */
    #advanceZoom(deltaSeconds) {
        if (Math.abs(this.#zoomTarget - this.#zoom) <= ZOOM_EPSILON) {
            this.#zoom = this.#zoomTarget;
            return;
        }
        if (this.#zoomDurationSeconds <= 0) {
            this.#zoom = this.#zoomTarget;
            this.#zoomElapsedSeconds = this.#zoomDurationSeconds;
            return;
        }
        this.#zoomElapsedSeconds = Math.min(
            this.#zoomDurationSeconds,
            this.#zoomElapsedSeconds + Math.max(0, Number(deltaSeconds) || 0)
        );
        const progress = this.#zoomElapsedSeconds / this.#zoomDurationSeconds;
        const eased = progress >= 1
            ? 1
            : 1 - Math.pow(2, -10 * progress);
        this.#zoom = this.#zoomStart
            + ((this.#zoomTarget - this.#zoomStart) * eased);
        if (progress >= 1) {
            this.#zoom = this.#zoomTarget;
        }
    }

    /** @returns {Readonly<{x:number,y:number,zoom:number,targetZoom:number,zooming:boolean,floorIndex:number,initialized:boolean}>} 현재 카메라 상태입니다. */
    getSnapshot() {
        return Object.freeze({
            x: this.#x,
            y: this.#y,
            zoom: this.#zoom,
            targetZoom: this.#zoomTarget,
            zooming: Math.abs(this.#zoomTarget - this.#zoom) > ZOOM_EPSILON,
            floorIndex: this.#floorIndex,
            initialized: this.#initialized
        });
    }

    /** 소유 상태를 정리합니다. */
    destroy() {
        this.clear();
    }
}

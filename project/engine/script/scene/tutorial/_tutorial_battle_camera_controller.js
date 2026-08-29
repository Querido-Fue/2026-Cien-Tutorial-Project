const AXIS_EPSILON = 0.0001;

/** @param {number} value @param {number} minimum @param {number} maximum */
function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

/** @param {*} value @returns {number} */
function finite(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * 가장자리 침투량을 -1~1 범위의 부드러운 입력으로 바꿉니다.
 * @param {number} position - 한 축의 포인터 위치입니다.
 * @param {number} size - 해당 축 뷰포트 크기입니다.
 * @param {number} margin - 가장자리 감지 폭입니다.
 * @returns {number} 부호가 포함된 스크롤 강도입니다.
 */
function resolveEdgeStrength(position, size, margin) {
    let raw = 0;
    if (position < margin) {
        raw = -clamp((margin - position) / margin, 0, 1);
    } else if (position > size - margin) {
        raw = clamp((position - (size - margin)) / margin, 0, 1);
    }
    const magnitude = Math.abs(raw);
    const smooth = magnitude * magnitude * (3 - (2 * magnitude));
    return Math.sign(raw) * smooth;
}

/**
 * @class TutorialBattleCameraController
 * @description 플레이어 추적점에 가장자리 스크롤 오프셋과 중앙 복귀를 결합합니다.
 */
export class TutorialBattleCameraController {
    #edgeMarginRatio;
    #edgeSpeedViewportRatioPerSecond;
    #maxDeltaSeconds;
    #defaultZoom;
    #maximumZoom;
    #wheelZoomRatio;
    #maximumWheelDelta;
    #offsetX;
    #offsetY;
    #targetZoom;
    #lastWheelTotalY;
    #wheelBaselineInitialized;
    #floorIndex;
    #initialized;
    #edgePanArmed;

    /**
     * @param {{edgeMarginRatio?:number,edgeSpeedViewportRatioPerSecond?:number,maxDeltaSeconds?:number,defaultZoom?:number,maximumZoom?:number,wheelZoomRatio?:number,maximumWheelDelta?:number}} [config={}] - 가장자리 스크롤과 휠 줌 설정입니다.
     */
    constructor(config = {}) {
        this.#edgeMarginRatio = clamp(
            finite(config.edgeMarginRatio) || 0.075,
            0.01,
            0.25
        );
        this.#edgeSpeedViewportRatioPerSecond = Math.max(
            0,
            finite(config.edgeSpeedViewportRatioPerSecond) || 0.48
        );
        this.#maxDeltaSeconds = clamp(
            finite(config.maxDeltaSeconds) || 0.05,
            1 / 240,
            0.25
        );
        this.#defaultZoom = Math.max(0.01, finite(config.defaultZoom) || 1);
        this.#maximumZoom = Math.max(
            this.#defaultZoom,
            finite(config.maximumZoom) || 1.2
        );
        this.#wheelZoomRatio = Math.max(
            1.001,
            finite(config.wheelZoomRatio) || 1.12
        );
        this.#maximumWheelDelta = Math.max(
            1,
            finite(config.maximumWheelDelta) || 12
        );
        this.clear();
    }

    /**
     * 새 런 또는 층의 플레이어 중앙으로 수동 카메라 상태를 초기화합니다.
     * @param {{x:number,y:number,floorIndex?:number}} target - 플레이어 위치입니다.
     */
    reset(target) {
        this.#offsetX = 0;
        this.#offsetY = 0;
        this.#targetZoom = this.#defaultZoom;
        this.#lastWheelTotalY = 0;
        this.#wheelBaselineInitialized = false;
        this.#floorIndex = finite(target?.floorIndex);
        this.#initialized = true;
        this.#edgePanArmed = true;
    }

    /** 수동 카메라 상태를 비웁니다. */
    clear() {
        this.#offsetX = 0;
        this.#offsetY = 0;
        this.#targetZoom = this.#defaultZoom;
        this.#lastWheelTotalY = 0;
        this.#wheelBaselineInitialized = false;
        this.#floorIndex = 0;
        this.#initialized = false;
        this.#edgePanArmed = true;
    }

    /**
     * 현재 포인터와 맵 축으로 다음 카메라 추적점을 계산합니다.
     * @param {object} options - 플레이어·레이아웃·입력 상태입니다.
     * @returns {{x:number,y:number}} 다음 카메라 추적점입니다.
     */
    update({
        player,
        floorIndex = 0,
        layout,
        pointer,
        wheel,
        deltaSeconds = 0,
        edgePanEnabled = false,
        zoomEnabled = false,
        recenter = false
    } = {}) {
        const playerX = finite(player?.x);
        const playerY = finite(player?.y);
        const normalizedFloorIndex = finite(floorIndex);
        if (!this.#initialized) {
            this.reset({ x: playerX, y: playerY, floorIndex: normalizedFloorIndex });
        } else if (normalizedFloorIndex !== this.#floorIndex) {
            this.#offsetX = 0;
            this.#offsetY = 0;
            this.#floorIndex = normalizedFloorIndex;
            this.#edgePanArmed = true;
        }
        this.#updateZoomTarget(layout, wheel, zoomEnabled);

        if (recenter) {
            this.#offsetX = 0;
            this.#offsetY = 0;
            this.#edgePanArmed = false;
        }

        const viewportWidth = Math.max(1, finite(layout?.viewport?.WW));
        const viewportHeight = Math.max(1, finite(layout?.viewport?.WH));
        const marginX = Math.max(1, viewportWidth * this.#edgeMarginRatio);
        const marginY = Math.max(1, viewportHeight * this.#edgeMarginRatio);
        const edgeX = resolveEdgeStrength(finite(pointer?.x), viewportWidth, marginX);
        const edgeY = resolveEdgeStrength(finite(pointer?.y), viewportHeight, marginY);
        const isAtEdge = Math.abs(edgeX) > AXIS_EPSILON
            || Math.abs(edgeY) > AXIS_EPSILON;
        if (!isAtEdge) {
            this.#edgePanArmed = true;
        }

        if (!recenter && edgePanEnabled && this.#edgePanArmed && isAtEdge) {
            const delta = clamp(finite(deltaSeconds), 0, this.#maxDeltaSeconds);
            const screenSpeed = Math.min(viewportWidth, viewportHeight)
                * this.#edgeSpeedViewportRatioPerSecond;
            const screenDeltaX = edgeX * screenSpeed * delta;
            const screenDeltaY = edgeY * screenSpeed * delta;
            const tileDelta = this.#screenDeltaToTileDelta(
                layout,
                screenDeltaX,
                screenDeltaY
            );
            this.#offsetX += tileDelta.x;
            this.#offsetY += tileDelta.y;
        }

        const maximumX = Math.max(0, finite(layout?.mapWidth) - 1);
        const maximumY = Math.max(0, finite(layout?.mapHeight) - 1);
        const targetX = clamp(playerX + this.#offsetX, 0, maximumX);
        const targetY = clamp(playerY + this.#offsetY, 0, maximumY);
        this.#offsetX = targetX - playerX;
        this.#offsetY = targetY - playerY;
        return Object.freeze({ x: targetX, y: targetY });
    }

    /** 최신 누적 휠값을 입력 기준점으로 삼아 이후 변화만 소비합니다. @param {object|null} wheel */
    primeWheelBaseline(wheel) {
        const totalY = Number(wheel?.totalY);
        if (!Number.isFinite(totalY)) {
            return;
        }
        this.#lastWheelTotalY = totalY;
        this.#wheelBaselineInitialized = true;
    }

    /** @returns {number} 연속 휠 입력이 누적되는 최신 목표 줌입니다. */
    getTargetZoom() {
        return this.#targetZoom;
    }

    /** @returns {{offsetX:number,offsetY:number,targetZoom:number,floorIndex:number,initialized:boolean,edgePanArmed:boolean,wheelBaselineInitialized:boolean}} */
    getSnapshot() {
        return Object.freeze({
            offsetX: this.#offsetX,
            offsetY: this.#offsetY,
            targetZoom: this.#targetZoom,
            floorIndex: this.#floorIndex,
            initialized: this.#initialized,
            edgePanArmed: this.#edgePanArmed,
            wheelBaselineInitialized: this.#wheelBaselineInitialized
        });
    }

    /** 카메라 입력 상태를 폐기합니다. */
    destroy() {
        this.clear();
    }

    /**
     * 화면 이동 벡터를 현재 아이소메트릭 격자의 타일 벡터로 역변환합니다.
     * @param {object} layout - 같은 프레임의 전투 레이아웃입니다.
     * @param {number} screenX - 화면 X 이동량입니다.
     * @param {number} screenY - 화면 Y 이동량입니다.
     * @returns {{x:number,y:number}} 타일 좌표 이동량입니다.
     * @private
     */
    #screenDeltaToTileDelta(layout, screenX, screenY) {
        const axisX = layout?.gridAxisX;
        const axisY = layout?.gridAxisY;
        const axisXX = finite(axisX?.x);
        const axisXY = finite(axisX?.y);
        const axisYX = finite(axisY?.x);
        const axisYY = finite(axisY?.y);
        const determinant = (axisXX * axisYY) - (axisXY * axisYX);
        if (Math.abs(determinant) <= AXIS_EPSILON) {
            return { x: 0, y: 0 };
        }
        return {
            x: ((screenX * axisYY) - (screenY * axisYX)) / determinant,
            y: ((screenY * axisXX) - (screenX * axisXY)) / determinant
        };
    }

    /**
     * 누적 휠 차분을 한 번만 소비해 최신 목표 줌을 갱신합니다.
     * @param {object} layout - 동적 최소 배율이 포함된 레이아웃입니다.
     * @param {object|null} wheel - 누적 휠 스냅샷입니다.
     * @param {boolean} enabled - 현재 줌 입력을 적용할 수 있는지 여부입니다.
     * @private
     */
    #updateZoomTarget(layout, wheel, enabled) {
        const bounds = layout?.cameraZoomBounds || {};
        const minimum = Math.max(
            0.01,
            Number.isFinite(Number(bounds.min))
                ? Number(bounds.min)
                : this.#defaultZoom
        );
        const maximum = Math.max(
            minimum,
            Number.isFinite(Number(bounds.max))
                ? Number(bounds.max)
                : this.#maximumZoom
        );
        this.#targetZoom = clamp(this.#targetZoom, minimum, maximum);

        const totalY = Number(wheel?.totalY);
        if (!Number.isFinite(totalY)) {
            return;
        }
        if (!this.#wheelBaselineInitialized) {
            this.primeWheelBaseline(wheel);
            return;
        }
        const wheelDelta = clamp(
            totalY - this.#lastWheelTotalY,
            -this.#maximumWheelDelta,
            this.#maximumWheelDelta
        );
        this.#lastWheelTotalY = totalY;
        if (!enabled || Math.abs(wheelDelta) <= AXIS_EPSILON) {
            return;
        }
        this.#targetZoom = clamp(
            this.#targetZoom * Math.pow(this.#wheelZoomRatio, -wheelDelta),
            minimum,
            maximum
        );
    }
}

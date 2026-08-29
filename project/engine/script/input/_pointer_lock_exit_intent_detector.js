const DEFAULT_EDGE_RATIO = 0.01;
const DEFAULT_EDGE_HOLD_MILLISECONDS = 1200;
const DEFAULT_DIRECTION_WINDOW_MILLISECONDS = 1000;
const DEFAULT_DIRECTION_TOLERANCE_DEGREES = 20;
const DEFAULT_DIRECTION_BUCKET_MILLISECONDS = 100;
const DEFAULT_MOVEMENT_CONTINUITY_MILLISECONDS = 240;
const MIN_MOVEMENT_DISTANCE = 0.01;
const MIN_DELIBERATE_DIRECTION_CHANGE_DISTANCE = 2;
const MIN_DIRECTION_WINDOW_DISTANCE = 6;
const MIN_DIRECTION_BUCKET_DISTANCE = 0.75;

const clamp = (value, minimum, maximum) => (
    Math.min(maximum, Math.max(minimum, value))
);

const toFiniteNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

const toRadians = (degrees) => degrees * (Math.PI / 180);

const getAngularDistance = (left, right) => {
    const difference = Math.atan2(
        Math.sin(left - right),
        Math.cos(left - right)
    );
    return Math.abs(difference);
};

const getAngularSpread = (angles) => {
    if (angles.length <= 1) {
        return 0;
    }
    const fullTurn = Math.PI * 2;
    const normalized = angles
        .map((angle) => ((angle % fullTurn) + fullTurn) % fullTurn)
        .sort((left, right) => left - right);
    let largestGap = 0;
    for (let index = 1; index < normalized.length; index++) {
        largestGap = Math.max(largestGap, normalized[index] - normalized[index - 1]);
    }
    largestGap = Math.max(
        largestGap,
        (normalized[0] + fullTurn) - normalized[normalized.length - 1]
    );
    return fullTurn - largestGap;
};

/**
 * 화면 가장자리 가운데 현재 포인터와 가장 가까운 한 변을 반환합니다.
 * @param {number} xRatio - 가로 정규화 좌표입니다.
 * @param {number} yRatio - 세로 정규화 좌표입니다.
 * @param {number} edgeRatio - 가장자리 판정 폭입니다.
 * @returns {string|null} left/right/top/bottom 또는 null입니다.
 */
const resolveEdge = (xRatio, yRatio, edgeRatio) => {
    const candidates = [];
    if (xRatio <= edgeRatio) candidates.push({ edge: 'left', distance: xRatio });
    if (xRatio >= 1 - edgeRatio) candidates.push({ edge: 'right', distance: 1 - xRatio });
    if (yRatio <= edgeRatio) candidates.push({ edge: 'top', distance: yRatio });
    if (yRatio >= 1 - edgeRatio) candidates.push({ edge: 'bottom', distance: 1 - yRatio });
    if (candidates.length === 0) {
        return null;
    }
    candidates.sort((left, right) => left.distance - right.distance);
    return candidates[0].edge;
};

/**
 * @class PointerLockExitIntentDetector
 * @description 가장자리 체류와 최근 1초의 안정된 바깥 방향 상대 이동을 함께 검사합니다.
 */
export class PointerLockExitIntentDetector {
    #edgeRatio;
    #edgeHoldMilliseconds;
    #directionWindowMilliseconds;
    #directionToleranceRadians;
    #directionBucketMilliseconds;
    #movementContinuityMilliseconds;
    #onChange;
    #edge;
    #edgeEnteredAt;
    #directionStartedAt;
    #lastMovementAt;
    #movementSamples;
    #movementSampleStartIndex;
    #visibleDirectionAngle;
    #xRatio;
    #yRatio;
    #visible;

    /**
     * @param {{
     * edgeRatio?:number,
     * edgeHoldMilliseconds?:number,
     * directionWindowMilliseconds?:number,
     * directionHoldMilliseconds?:number,
     * directionToleranceDegrees?:number,
     * directionBucketMilliseconds?:number,
     * movementContinuityMilliseconds?:number,
     * onChange?:Function
     * }} [options={}] - 판정 임계값과 상태 콜백입니다.
     */
    constructor(options = {}) {
        this.#edgeRatio = clamp(
            toFiniteNumber(options.edgeRatio, DEFAULT_EDGE_RATIO),
            0.001,
            0.25
        );
        this.#edgeHoldMilliseconds = Math.max(
            0,
            toFiniteNumber(
                options.edgeHoldMilliseconds,
                DEFAULT_EDGE_HOLD_MILLISECONDS
            )
        );
        this.#directionWindowMilliseconds = Math.max(
            100,
            toFiniteNumber(
                options.directionWindowMilliseconds
                    ?? options.directionHoldMilliseconds,
                DEFAULT_DIRECTION_WINDOW_MILLISECONDS
            )
        );
        this.#directionToleranceRadians = toRadians(clamp(
            toFiniteNumber(
                options.directionToleranceDegrees,
                DEFAULT_DIRECTION_TOLERANCE_DEGREES
            ),
            1,
            90
        ));
        this.#directionBucketMilliseconds = Math.max(
            16,
            toFiniteNumber(
                options.directionBucketMilliseconds,
                DEFAULT_DIRECTION_BUCKET_MILLISECONDS
            )
        );
        this.#movementContinuityMilliseconds = Math.max(
            16,
            toFiniteNumber(
                options.movementContinuityMilliseconds,
                DEFAULT_MOVEMENT_CONTINUITY_MILLISECONDS
            )
        );
        this.#onChange = typeof options.onChange === 'function'
            ? options.onChange
            : null;
        this.#edge = null;
        this.#edgeEnteredAt = null;
        this.#directionStartedAt = null;
        this.#lastMovementAt = null;
        this.#movementSamples = [];
        this.#movementSampleStartIndex = 0;
        this.#visibleDirectionAngle = null;
        this.#xRatio = 0.5;
        this.#yRatio = 0.5;
        this.#visible = false;
    }

    /**
     * 잠금 중 발생한 원시 상대 이동과 갱신된 가상 커서 좌표를 기록합니다.
     * @param {{
     * locked?:boolean,
     * pointerX?:number,
     * pointerY?:number,
     * viewportWidth?:number,
     * viewportHeight?:number,
     * movementX?:number,
     * movementY?:number,
     * timeMilliseconds?:number
     * }} sample - 상대 이동 샘플입니다.
     */
    record(sample = {}) {
        const locked = sample.locked === true;
        const viewportWidth = Math.max(0, toFiniteNumber(sample.viewportWidth, 0));
        const viewportHeight = Math.max(0, toFiniteNumber(sample.viewportHeight, 0));
        const now = toFiniteNumber(sample.timeMilliseconds, 0);
        if (!locked || viewportWidth <= 0 || viewportHeight <= 0) {
            this.reset();
            return;
        }

        this.#xRatio = clamp(
            toFiniteNumber(sample.pointerX, 0) / viewportWidth,
            0,
            1
        );
        this.#yRatio = clamp(
            toFiniteNumber(sample.pointerY, 0) / viewportHeight,
            0,
            1
        );
        const nextEdge = resolveEdge(this.#xRatio, this.#yRatio, this.#edgeRatio);
        if (!nextEdge) {
            this.reset();
            return;
        }
        if (this.#edge === null) {
            this.#edge = nextEdge;
            this.#edgeEnteredAt = now;
            this.#resetDirectionWindow();
            this.#setVisible(false);
        } else {
            // 모서리에서는 가장 가까운 변이 교대로 바뀌어도 같은 1% 영역 체류입니다.
            this.#edge = nextEdge;
        }

        const movementX = toFiniteNumber(sample.movementX, 0);
        const movementY = toFiniteNumber(sample.movementY, 0);
        const movementDistance = Math.hypot(movementX, movementY);
        if (movementDistance >= MIN_MOVEMENT_DISTANCE) {
            this.#recordDirection(movementX, movementY, movementDistance, now);
        }
        this.#evaluate(now, true);
    }

    /**
     * 상대 이동 이벤트가 잠시 끊겼을 때 연속 이동 조건을 갱신합니다.
     * @param {number} timeMilliseconds - 현재 단조 증가 시각입니다.
     */
    update(timeMilliseconds) {
        this.#evaluate(toFiniteNumber(timeMilliseconds, 0), false);
    }

    /** 모든 누적 판정 상태를 초기화합니다. */
    reset() {
        const wasVisible = this.#visible;
        this.#edge = null;
        this.#edgeEnteredAt = null;
        this.#resetDirectionWindow();
        this.#visible = false;
        if (wasVisible) {
            this.#emitChange();
        }
    }

    /** @returns {Readonly<object>} UI에 전달할 방어 스냅샷입니다. */
    getSnapshot() {
        return Object.freeze({
            visible: this.#visible,
            edge: this.#edge,
            xRatio: this.#xRatio,
            yRatio: this.#yRatio
        });
    }

    /** 콜백 참조와 판정 상태를 해제합니다. */
    destroy() {
        this.reset();
        this.#onChange = null;
    }

    /**
     * @param {number} movementX @param {number} movementY
     * @param {number} movementDistance @param {number} now @private
     */
    #recordDirection(movementX, movementY, movementDistance, now) {
        const movementAngle = Math.atan2(movementY, movementX);
        const continuityBroken = this.#lastMovementAt === null
            || now - this.#lastMovementAt > this.#movementContinuityMilliseconds;
        const deliberateDirectionChange = this.#visible
            && this.#visibleDirectionAngle !== null
            && movementDistance >= MIN_DELIBERATE_DIRECTION_CHANGE_DISTANCE
            && getAngularDistance(
                movementAngle,
                this.#visibleDirectionAngle
            ) > this.#directionToleranceRadians;

        if (continuityBroken || deliberateDirectionChange) {
            this.#setVisible(false);
            this.#resetDirectionWindow();
        }
        if (this.#directionStartedAt === null) {
            this.#directionStartedAt = now;
        }
        this.#movementSamples.push({
            time: now,
            x: movementX,
            y: movementY,
            distance: movementDistance
        });
        this.#lastMovementAt = now;
        this.#pruneMovementSamples(now);
    }

    /** @param {number} now @param {boolean} positionChanged @private */
    #evaluate(now, positionChanged) {
        const movementIsContinuous = this.#lastMovementAt !== null
            && now - this.#lastMovementAt <= this.#movementContinuityMilliseconds;
        if (!movementIsContinuous) {
            this.#setVisible(false);
            this.#resetDirectionWindow();
            return;
        }

        const edgeHeldLongEnough = this.#edgeEnteredAt !== null
            && now - this.#edgeEnteredAt >= this.#edgeHoldMilliseconds;
        const directionObservedLongEnough = this.#directionStartedAt !== null
            && now - this.#directionStartedAt >= this.#directionWindowMilliseconds;
        if (!this.#edge || !edgeHeldLongEnough || !directionObservedLongEnough) {
            this.#setVisible(false);
            return;
        }

        this.#pruneMovementSamples(now);
        const direction = this.#resolveStableDirection();
        const nextVisible = Boolean(
            direction.stable
        );
        const visibilityChanged = this.#visible !== nextVisible;
        this.#visible = nextVisible;
        this.#visibleDirectionAngle = nextVisible ? direction.angle : null;
        if (visibilityChanged || (nextVisible && positionChanged)) {
            this.#emitChange();
        }
    }

    /**
     * 100ms 단위 합성 벡터가 모두 하나의 20° 원호 안에 드는지 확인합니다.
     * @returns {{stable:boolean,angle:number|null}} 판정 결과입니다.
     * @private
     */
    #resolveStableDirection() {
        if (this.#movementSampleStartIndex >= this.#movementSamples.length) {
            return { stable: false, angle: null };
        }
        let totalX = 0;
        let totalY = 0;
        let totalDistance = 0;
        const buckets = new Map();
        for (let index = this.#movementSampleStartIndex;
            index < this.#movementSamples.length;
            index++) {
            const sample = this.#movementSamples[index];
            totalX += sample.x;
            totalY += sample.y;
            totalDistance += sample.distance;
            const bucketKey = Math.floor(sample.time / this.#directionBucketMilliseconds);
            const bucket = buckets.get(bucketKey) || { x: 0, y: 0 };
            bucket.x += sample.x;
            bucket.y += sample.y;
            buckets.set(bucketKey, bucket);
        }
        if (totalDistance < MIN_DIRECTION_WINDOW_DISTANCE
            || Math.hypot(totalX, totalY) < MIN_DIRECTION_BUCKET_DISTANCE) {
            return { stable: false, angle: null };
        }

        const angle = Math.atan2(totalY, totalX);
        const outwardAngle = Math.atan2(
            this.#yRatio - 0.5,
            this.#xRatio - 0.5
        );
        if (Math.cos(angle - outwardAngle) <= 0) {
            return { stable: false, angle: null };
        }

        let bucketAngles = Array.from(buckets.values())
            .filter((bucket) => Math.hypot(bucket.x, bucket.y) >= MIN_DIRECTION_BUCKET_DISTANCE)
            .map((bucket) => Math.atan2(bucket.y, bucket.x));
        // 이동 창 양 끝의 불완전한 버킷은 1px 잡음 하나만 남을 수 있으므로 제외합니다.
        if (bucketAngles.length > 4) {
            bucketAngles = bucketAngles.slice(1, -1);
        }
        if (bucketAngles.length < 3
            || getAngularSpread(bucketAngles) > this.#directionToleranceRadians) {
            return { stable: false, angle: null };
        }
        return { stable: true, angle };
    }

    /** @param {number} now @private */
    #pruneMovementSamples(now) {
        const cutoff = now - this.#directionWindowMilliseconds;
        while (this.#movementSampleStartIndex < this.#movementSamples.length
            && this.#movementSamples[this.#movementSampleStartIndex].time < cutoff) {
            this.#movementSampleStartIndex += 1;
        }
        if (this.#movementSampleStartIndex >= 64
            && this.#movementSampleStartIndex * 2 >= this.#movementSamples.length) {
            this.#movementSamples = this.#movementSamples.slice(
                this.#movementSampleStartIndex
            );
            this.#movementSampleStartIndex = 0;
        }
    }

    /** @private */
    #resetDirectionWindow() {
        this.#directionStartedAt = null;
        this.#lastMovementAt = null;
        this.#movementSamples.length = 0;
        this.#movementSampleStartIndex = 0;
        this.#visibleDirectionAngle = null;
    }

    /** @param {boolean} visible @private */
    #setVisible(visible) {
        if (this.#visible === visible) {
            if (!visible) {
                this.#visibleDirectionAngle = null;
            }
            return;
        }
        this.#visible = visible;
        this.#visibleDirectionAngle = visible
            ? this.#visibleDirectionAngle
            : null;
        this.#emitChange();
    }

    /** @private */
    #emitChange() {
        this.#onChange?.(this.getSnapshot());
    }
}

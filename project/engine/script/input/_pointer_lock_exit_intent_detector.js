const DEFAULT_EDGE_RATIO = 0.01;
const DEFAULT_EDGE_HOLD_MILLISECONDS = 1000;
const DEFAULT_MINIMUM_VISIBLE_MILLISECONDS = 500;

const clamp = (value, minimum, maximum) => (
    Math.min(maximum, Math.max(minimum, value))
);

const toFiniteNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

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
 * @description 이동 방향과 무관하게 1초간 화면 가장자리에 머문 이탈 의도를 판정합니다.
 */
export class PointerLockExitIntentDetector {
    #edgeRatio;
    #edgeHoldMilliseconds;
    #minimumVisibleMilliseconds;
    #onChange;
    #edge;
    #edgeEnteredAt;
    #visibleEdge;
    #visibleSince;
    #xRatio;
    #yRatio;
    #visible;

    /**
     * @param {{
     * edgeRatio?:number,
     * edgeHoldMilliseconds?:number,
     * minimumVisibleMilliseconds?:number,
     * onChange?:Function
     * }} [options={}] - 가장자리 체류 임계값과 상태 콜백입니다.
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
        this.#minimumVisibleMilliseconds = Math.max(
            0,
            toFiniteNumber(
                options.minimumVisibleMilliseconds,
                DEFAULT_MINIMUM_VISIBLE_MILLISECONDS
            )
        );
        this.#onChange = typeof options.onChange === 'function'
            ? options.onChange
            : null;
        this.#edge = null;
        this.#edgeEnteredAt = null;
        this.#visibleEdge = null;
        this.#visibleSince = null;
        this.#xRatio = 0.5;
        this.#yRatio = 0.5;
        this.#visible = false;
    }

    /**
     * 잠금 중 갱신된 가상 커서 좌표를 기록합니다.
     * 상대 이동의 방향과 각도는 이탈 의도 판정에 사용하지 않습니다.
     * @param {{
     * locked?:boolean,
     * pointerX?:number,
     * pointerY?:number,
     * viewportWidth?:number,
     * viewportHeight?:number,
     * timeMilliseconds?:number
     * }} sample - 현재 포인터 위치 샘플입니다.
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
            this.#edge = null;
            this.#edgeEnteredAt = null;
            this.#setVisible(false, now);
            return;
        }
        if (this.#edge === null) {
            this.#edgeEnteredAt = now;
            this.#setVisible(false, now);
        }
        // 모서리에서는 가장 가까운 변이 바뀌어도 같은 가장자리 체류로 봅니다.
        this.#edge = nextEdge;
        this.#evaluate(now, true);
    }

    /**
     * 상대 이동 이벤트가 없을 때도 가장자리 체류 시간을 갱신합니다.
     * @param {number} timeMilliseconds - 현재 단조 증가 시각입니다.
     */
    update(timeMilliseconds) {
        this.#evaluate(toFiniteNumber(timeMilliseconds, 0), false);
    }

    /** 모든 누적 판정 상태를 초기화합니다. */
    reset() {
        this.#edge = null;
        this.#edgeEnteredAt = null;
        this.#setVisible(false, 0, true);
    }

    /** @returns {Readonly<object>} UI에 전달할 방어 스냅샷입니다. */
    getSnapshot() {
        return Object.freeze({
            visible: this.#visible,
            edge: this.#visible ? (this.#edge || this.#visibleEdge) : this.#edge,
            xRatio: this.#xRatio,
            yRatio: this.#yRatio
        });
    }

    /** 콜백 참조와 판정 상태를 해제합니다. */
    destroy() {
        this.reset();
        this.#onChange = null;
    }

    /** @param {number} now @param {boolean} positionChanged @private */
    #evaluate(now, positionChanged) {
        if (!this.#edge) {
            this.#setVisible(false, now);
            return;
        }
        const edgeHeldLongEnough = this.#edgeEnteredAt !== null
            && now - this.#edgeEnteredAt >= this.#edgeHoldMilliseconds;
        const visibilityChanged = this.#setVisible(edgeHeldLongEnough, now);
        if (this.#visible && positionChanged && !visibilityChanged) {
            this.#emitChange();
        }
    }

    /**
     * 최소 표시 시간을 보존하면서 안내 표시 상태를 전환합니다.
     * @param {boolean} visible - 목표 표시 여부입니다.
     * @param {number} now - 현재 단조 증가 시각입니다.
     * @param {boolean} [force=false] - 잠금 해제처럼 즉시 숨겨야 하는지 여부입니다.
     * @returns {boolean} 표시 상태가 실제로 바뀌었는지 여부입니다.
     * @private
     */
    #setVisible(visible, now, force = false) {
        const currentTime = toFiniteNumber(now, 0);
        if (visible) {
            if (this.#edge) {
                this.#visibleEdge = this.#edge;
            }
            if (this.#visible) {
                return false;
            }
            this.#visible = true;
            this.#visibleSince = currentTime;
            this.#emitChange();
            return true;
        }
        if (!this.#visible) {
            this.#visibleEdge = null;
            this.#visibleSince = null;
            return false;
        }
        if (!force
            && this.#visibleSince !== null
            && currentTime - this.#visibleSince < this.#minimumVisibleMilliseconds) {
            return false;
        }
        this.#visible = false;
        this.#visibleSince = null;
        this.#visibleEdge = null;
        this.#emitChange();
        return true;
    }

    /** @private */
    #emitChange() {
        this.#onChange?.(this.getSnapshot());
    }
}

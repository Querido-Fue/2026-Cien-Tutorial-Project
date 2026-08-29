/** @param {*} value @param {number} minimum @param {number} maximum @returns {number} 범위 안 정수입니다. */
function clampInteger(value, minimum, maximum) {
    const number = Math.trunc(Number(value));
    return Number.isFinite(number)
        ? Math.max(minimum, Math.min(maximum, number))
        : minimum;
}

/**
 * @class TutorialLoadingCoordinator
 * @description 에셋과 메타 데이터의 실제 완료 수를 합산하고 한 번만 장면 진입을 승인합니다.
 */
export class TutorialLoadingCoordinator {
    #assetPort;
    #onReady;
    #meta;
    #metaReady;
    #completionSignaled;
    #destroyed;

    /**
     * @param {object} options - 에셋 진행도 포트와 전체 완료 콜백입니다.
     * @param {{getLoadProgress:Function}} options.assetPort - 에셋 진행도 포트입니다.
     * @param {Function} options.onReady - 전체 완료 시 메타 데이터를 받는 콜백입니다.
     */
    constructor({ assetPort, onReady = () => {} }) {
        this.#assetPort = assetPort;
        this.#onReady = onReady;
        this.#meta = null;
        this.#metaReady = false;
        this.#completionSignaled = false;
        this.#destroyed = false;
    }

    /**
     * 저장 데이터 로드 완료를 기록하고 전체 완료 여부를 다시 검사합니다.
     * @param {object} meta - 불러온 튜토리얼 메타 데이터입니다.
     */
    resolveMeta(meta) {
        if (this.#destroyed || this.#metaReady) {
            return;
        }
        this.#meta = meta;
        this.#metaReady = true;
        this.#trySignalReady();
    }

    /** 에셋 상태 변경 뒤 전체 완료 여부를 다시 검사합니다. */
    refresh() {
        if (!this.#destroyed) {
            this.#trySignalReady();
        }
    }

    /**
     * 저장 데이터 한 건과 에셋 전체를 같은 작업 단위로 합산합니다.
     * @returns {Readonly<object>} 직렬화 가능한 로딩 진행도입니다.
     */
    getSnapshot() {
        const assets = this.#getAssetProgress();
        const metaCompleted = this.#metaReady ? 1 : 0;
        const total = assets.total + 1;
        const completed = assets.completed + metaCompleted;
        const ratio = total > 0 ? completed / total : 1;
        return Object.freeze({
            completed,
            total,
            pending: Math.max(0, total - completed),
            ratio,
            percent: Math.round(ratio * 100),
            assetCompleted: assets.completed,
            assetTotal: assets.total,
            metaCompleted
        });
    }

    /** 완료 콜백과 보유 메타 참조를 해제합니다. */
    destroy() {
        this.#destroyed = true;
        this.#meta = null;
        this.#onReady = () => {};
    }

    /** @returns {{completed:number,total:number}} 정규화된 에셋 진행도입니다. @private */
    #getAssetProgress() {
        const raw = this.#assetPort?.getLoadProgress?.() || {};
        const total = Math.max(0, Math.trunc(Number(raw.total)) || 0);
        return {
            total,
            completed: clampInteger(raw.completed, 0, total)
        };
    }

    /** 모든 작업이 끝났을 때 완료 콜백을 정확히 한 번 호출합니다. @private */
    #trySignalReady() {
        if (this.#completionSignaled || !this.#metaReady) {
            return;
        }
        const snapshot = this.getSnapshot();
        if (snapshot.pending > 0) {
            return;
        }
        this.#completionSignaled = true;
        this.#onReady(this.#meta);
    }
}

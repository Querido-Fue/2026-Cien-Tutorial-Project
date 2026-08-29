import { clampNumber, cloneValue } from './_tutorial_value_utils.js';

const FALLBACK_ENDING = Object.freeze({
    id: 'failure',
    displayName: 'happily ever after..?',
    cutsceneId: null
});

/**
 * 전투 종료 판정, 엔딩 표시 데이터와 엔딩 컷씬 대기 상태를 소유합니다.
 */
export class TutorialResultController {
    /** @param {object} options - 엔딩 데이터와 결과 기록 포트입니다. */
    constructor(options = {}) {
        this.endings = Array.isArray(options.endings) ? options.endings : [];
        this.recordResult = options.recordResult;
        this.reset();
    }

    /** 새 런을 위해 결과와 대기 중인 엔딩 컷씬을 지웁니다. */
    reset() {
        this.data = null;
        this.recorded = false;
        this.pendingCutsceneId = null;
    }

    /** @returns {object|null} 표시용 결과의 방어 복제본입니다. */
    getData() {
        return this.data ? cloneValue(this.data) : null;
    }

    /** @param {string} cutsceneId @returns {boolean} 엔딩 컷씬 여부입니다. */
    isEndingCutsceneId(cutsceneId) {
        return this.endings.some((ending) => ending.cutsceneId === cutsceneId);
    }

    /** 엔딩 결과가 확정될 때까지 컷씬 ID를 보관합니다. */
    queueEndingCutscene(cutsceneId) {
        if (!this.isEndingCutsceneId(cutsceneId)) {
            return false;
        }
        this.pendingCutsceneId = cutsceneId;
        return true;
    }

    /**
     * 모델 결과가 있고 외부 연출이 모두 끝났으면 결과 데이터를 한 번만 확정합니다.
     * @returns {{entered:boolean,endingCutsceneId:string|null,data:object|null}}
     */
    tryEnter(options = {}) {
        const model = options.model;
        if (!model || this.recorded || options.hasRecordWork === true) {
            return this.#noEntry();
        }
        const snapshot = options.snapshot;
        const rawResult = model.result || snapshot?.result;
        if (!rawResult || options.blocked === true) {
            return this.#noEntry();
        }
        const endingSource = rawResult.endingId
            || rawResult.ending?.id
            || rawResult.ending
            || rawResult.id;
        const endingId = typeof endingSource === 'string'
            ? endingSource
            : FALLBACK_ENDING.id;
        const ending = this.#getEndingDefinition(endingId);
        const instability = clampNumber(
            rawResult.instability ?? model.lora?.instability,
            0,
            100
        );
        this.data = {
            ...cloneValue(rawResult),
            endingId,
            instability,
            displayName: ending.displayName,
            label: rawResult.label || '작전 종료'
        };
        this.recorded = true;
        this.recordResult?.(endingId);
        const endingCutsceneId = this.pendingCutsceneId === ending.cutsceneId
            ? this.pendingCutsceneId
            : null;
        this.pendingCutsceneId = null;
        return {
            entered: true,
            endingCutsceneId,
            data: this.getData()
        };
    }

    /** @returns {object} 표시명과 컷씬이 분리된 엔딩 정의입니다. */
    #getEndingDefinition(endingId) {
        return this.endings.find((ending) => ending.id === endingId)
            || this.endings.find((ending) => ending.id === FALLBACK_ENDING.id)
            || FALLBACK_ENDING;
    }

    /** @returns {{entered:false,endingCutsceneId:null,data:object|null}} */
    #noEntry() {
        return {
            entered: false,
            endingCutsceneId: null,
            data: this.getData()
        };
    }
}

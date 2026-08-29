import {
    createDefaultTutorialMeta,
    identifyTutorialItem,
    markTutorialCombatGuideSeen,
    markTutorialOpeningWatched,
    recordTutorialResult,
    saveTutorialMeta,
    unlockTutorialAchievement,
    unlockTutorialCutscene,
    unlockTutorialRecord
} from './_tutorial_meta_progress.js';
import {
    areSerializableValuesEqual,
    cloneValue,
    toList
} from './_tutorial_value_utils.js';

/**
 * 한 튜토리얼 장면의 메타 staging, 진행 연산과 순차 저장을 소유합니다.
 */
export class TutorialMetaSession {
    /**
     * @param {object} [options={}] - 초기 메타와 저장 포트입니다.
     * @param {object} [options.initialMeta] - 초기 진행도입니다.
     * @param {(meta:object)=>Promise<object>} [options.save] - 비동기 저장 함수입니다.
     * @param {(error:Error)=>void} [options.onSaveError] - 저장 오류 보고 함수입니다.
     */
    constructor({
        initialMeta = createDefaultTutorialMeta(),
        save = saveTutorialMeta,
        onSaveError = (error) => console.warn('튜토리얼 진행도 저장 오류:', error)
    } = {}) {
        this.save = save;
        this.onSaveError = onSaveError;
        this.meta = cloneValue(initialMeta);
        this.committedMeta = cloneValue(this.meta);
        this.staging = false;
        this.writesBlocked = false;
        this.saveSequence = Promise.resolve();
    }

    /** @returns {object} 현재 장면이 읽을 메타입니다. */
    get current() {
        return this.meta;
    }

    /**
     * 로드가 끝난 메타를 현재·확정 상태의 새 기준으로 설정합니다.
     * @param {object} meta - 로드된 메타입니다.
     */
    setLoaded(meta) {
        this.meta = cloneValue(meta || createDefaultTutorialMeta());
        this.committedMeta = cloneValue(this.meta);
        this.staging = false;
    }

    /** @param {boolean} blocked 미래 버전 보호 등으로 저장을 막을지 여부입니다. */
    setWritesBlocked(blocked) {
        this.writesBlocked = blocked === true;
    }

    /** 새 런의 중간 진행을 종료 경계까지 staging합니다. */
    beginStaging() {
        this.staging = true;
    }

    /**
     * 현재 메타와 다른 값만 교체하고 정책에 따라 저장합니다.
     * @param {object} nextMeta - 새 메타입니다.
     * @param {{persist?:boolean}} [options={}] - staging 중 즉시 저장할지 여부입니다.
     * @returns {boolean} 실제로 값이 바뀌었는지 여부입니다.
     */
    replace(nextMeta, { persist = false } = {}) {
        if (!nextMeta || areSerializableValuesEqual(this.meta, nextMeta)) {
            return false;
        }
        this.meta = nextMeta;
        if (!this.staging || persist) {
            this.committedMeta = cloneValue(this.meta);
            this.#queueSave(this.committedMeta);
        }
        return true;
    }

    /** 현재 런에서 쌓인 진행도를 이탈 경계에서 한 번만 확정합니다. */
    commitStaged() {
        if (!this.staging) {
            return;
        }
        this.staging = false;
        if (areSerializableValuesEqual(this.committedMeta, this.meta)) {
            return;
        }
        this.committedMeta = cloneValue(this.meta);
        this.#queueSave(this.committedMeta);
    }

    /** @param {readonly string[]} ids 새로 해금된 업적 ID 목록입니다. */
    unlockAchievements(ids) {
        let nextMeta = this.meta;
        for (const id of ids) {
            nextMeta = unlockTutorialAchievement(nextMeta, id);
        }
        this.replace(nextMeta);
    }

    /**
     * 완료 또는 스킵한 컷씬을 해금하고 오프닝 확인 상태를 함께 기록합니다.
     * @param {string} id - 컷씬 ID입니다.
     * @param {string|null} openingCutsceneId - 오프닝 컷씬 ID입니다.
     */
    recordCutsceneSeen(id, openingCutsceneId) {
        if (typeof id !== 'string' || !id) {
            return;
        }
        let nextMeta = unlockTutorialCutscene(this.meta, id);
        if (id === openingCutsceneId) {
            nextMeta = markTutorialOpeningWatched(nextMeta);
        }
        this.replace(nextMeta);
    }

    /** 전투 안내를 확인한 진행도를 기록합니다. */
    markCombatGuideSeen() {
        this.replace(markTutorialCombatGuideSeen(this.meta));
    }

    /** @param {string} endingId 완료한 엔딩 ID입니다. */
    recordResult(endingId) {
        this.replace(recordTutorialResult(this.meta, { endingId }));
    }

    /**
     * 모델 스냅샷의 사용 아이템·식별 지식·획득 기록을 메타에 병합합니다.
     * @param {object|null} snapshot - 전투 모델 스냅샷입니다.
     */
    syncBattleSnapshot(snapshot) {
        let nextMeta = this.meta;
        let recordUnlocked = false;
        for (const itemId of toList(snapshot?.usedItems)) {
            const normalizedId = typeof itemId === 'string' ? itemId : itemId?.itemId;
            if (normalizedId) {
                nextMeta = identifyTutorialItem(nextMeta, normalizedId);
            }
        }
        for (const itemId of toList(snapshot?.knowledge?.identifiedItemIds)) {
            if (typeof itemId === 'string') {
                nextMeta = identifyTutorialItem(nextMeta, itemId);
            }
        }
        for (const recordId of toList(snapshot?.knowledge?.unlockedRecordIds)) {
            if (typeof recordId !== 'string') {
                continue;
            }
            if (!nextMeta.unlockedRecordIds.includes(recordId)) {
                recordUnlocked = true;
            }
            nextMeta = unlockTutorialRecord(nextMeta, recordId);
        }
        this.replace(nextMeta, { persist: recordUnlocked });
    }

    /** @returns {Promise<void>} 현재까지 예약된 저장 완료를 기다립니다. */
    async whenIdle() {
        await this.saveSequence;
    }

    /** 확정 메타 복제본을 순서대로 저장합니다. */
    #queueSave(meta) {
        if (this.writesBlocked) {
            return;
        }
        const snapshot = cloneValue(meta);
        this.saveSequence = this.saveSequence
            .then(() => this.save(snapshot))
            .catch((error) => this.onSaveError(error));
    }
}

import {
    createDefaultTutorialMeta,
    isTutorialMetaRecord,
    TUTORIAL_META_VERSION
} from './_tutorial_meta_schema.js';
import { TutorialMetaMigrator } from './_tutorial_meta_migrator.js';
import {
    isTutorialMetaFutureVersionError,
    TutorialMetaVersionError
} from './_tutorial_meta_version_error.js';

export const TUTORIAL_META_RUNTIME_KEY = 'tutorialMeta';
const META_MIGRATOR = new TutorialMetaMigrator();

export {
    createDefaultTutorialMeta,
    isTutorialMetaFutureVersionError,
    TutorialMetaVersionError,
    TUTORIAL_META_VERSION
};

/** @param {*} value @returns {object} 현재 버전 메타입니다. */
export function normalizeTutorialMeta(value) {
    return META_MIGRATOR.migrate(value);
}

/** @param {string[]} ids @param {*} candidate @returns {string[]} */
function appendUniqueId(ids, candidate) {
    const id = typeof candidate === 'string' ? candidate.trim() : '';
    if (!id || ids.includes(id)) {
        return [...ids];
    }
    return [...ids, id];
}

/** @param {string[]} ids @param {*} candidates @returns {string[]} */
function appendUniqueIds(ids, candidates) {
    let nextIds = [...ids];
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
        nextIds = appendUniqueId(nextIds, candidate);
    }
    return nextIds;
}

/**
 * 주입된 저장 함수 또는 NW.js 기본 SaveSystem 함수를 지연 해석합니다.
 * @param {object|undefined} dependencies - 테스트 또는 대체 저장소 의존성입니다.
 * @param {'getRuntimeStateValue'|'setRuntimeStateValue'} methodName - 필요한 함수입니다.
 * @returns {Promise<Function>} 사용할 저장 함수입니다.
 */
async function resolveRuntimeStateMethod(dependencies, methodName) {
    const injectedMethod = dependencies?.[methodName];
    if (typeof injectedMethod === 'function') {
        return injectedMethod;
    }
    const saveModule = await import('save/save_system.js');
    const runtimeMethod = saveModule[methodName];
    if (typeof runtimeMethod !== 'function') {
        throw new Error(`튜토리얼 메타 저장 함수가 없습니다: ${methodName}`);
    }
    return runtimeMethod;
}

/** @param {object} [dependencies] @returns {Promise<object>} 현재 메타입니다. */
export async function loadTutorialMeta(dependencies) {
    const getRuntimeStateValue = await resolveRuntimeStateMethod(
        dependencies,
        'getRuntimeStateValue'
    );
    return normalizeTutorialMeta(
        await getRuntimeStateValue(TUTORIAL_META_RUNTIME_KEY)
    );
}

/** @param {*} meta @param {object} [dependencies] @returns {Promise<object>} */
export async function saveTutorialMeta(meta, dependencies) {
    const storedMeta = normalizeTutorialMeta(meta);
    const setRuntimeStateValue = await resolveRuntimeStateMethod(
        dependencies,
        'setRuntimeStateValue'
    );
    await setRuntimeStateValue(TUTORIAL_META_RUNTIME_KEY, storedMeta);
    return normalizeTutorialMeta(storedMeta);
}

/** @param {*} meta @returns {object} */
export function markTutorialOpeningWatched(meta) {
    return { ...normalizeTutorialMeta(meta), openingWatched: true };
}

/** @param {*} meta @returns {object} */
export function markTutorialCombatGuideSeen(meta) {
    return { ...normalizeTutorialMeta(meta), combatGuideSeen: true };
}

/** @param {*} meta @param {*} id @returns {object} */
export function identifyTutorialItem(meta, id) {
    const normalizedMeta = normalizeTutorialMeta(meta);
    return {
        ...normalizedMeta,
        identifiedItemIds: appendUniqueId(normalizedMeta.identifiedItemIds, id)
    };
}

/** @param {*} meta @param {*} id @returns {object} */
export function revealTutorialEventTile(meta, id) {
    const normalizedMeta = normalizeTutorialMeta(meta);
    return {
        ...normalizedMeta,
        revealedEventTileIds: appendUniqueId(normalizedMeta.revealedEventTileIds, id)
    };
}

/** @param {*} meta @param {*} id @returns {object} */
export function unlockTutorialCutscene(meta, id) {
    const normalizedMeta = normalizeTutorialMeta(meta);
    return {
        ...normalizedMeta,
        unlockedCutsceneIds: appendUniqueId(normalizedMeta.unlockedCutsceneIds, id)
    };
}

/** @param {*} meta @param {*} id @returns {object} */
export function unlockTutorialAchievement(meta, id) {
    const normalizedMeta = normalizeTutorialMeta(meta);
    return {
        ...normalizedMeta,
        unlockedAchievementIds: appendUniqueId(
            normalizedMeta.unlockedAchievementIds,
            id
        )
    };
}

/** @param {*} meta @param {*} id @returns {object} */
export function unlockTutorialRecord(meta, id) {
    const normalizedMeta = normalizeTutorialMeta(meta);
    return {
        ...normalizedMeta,
        unlockedRecordIds: appendUniqueId(normalizedMeta.unlockedRecordIds, id)
    };
}

/**
 * 현재 플레이 결과와 오프닝 확인 여부는 건드리지 않고 모든 갤러리 ID를 병합합니다.
 * @param {*} meta - 현재 메타 진행도입니다.
 * @param {object} [catalog={}] - 갤러리 종류별 전체 ID 목록입니다.
 * @returns {object} 전체 갤러리 해금이 반영된 메타입니다.
 */
export function unlockTutorialGallery(meta, catalog = {}) {
    const normalizedMeta = normalizeTutorialMeta(meta);
    return {
        ...normalizedMeta,
        unlockedCutsceneIds: appendUniqueIds(
            normalizedMeta.unlockedCutsceneIds,
            catalog.cutsceneIds
        ),
        unlockedAchievementIds: appendUniqueIds(
            normalizedMeta.unlockedAchievementIds,
            catalog.achievementIds
        ),
        unlockedRecordIds: appendUniqueIds(
            normalizedMeta.unlockedRecordIds,
            catalog.recordIds
        ),
        endingIds: appendUniqueIds(normalizedMeta.endingIds, catalog.endingIds)
    };
}

/** @param {*} meta @param {{endingId?:*}} [result] @returns {object} */
export function recordTutorialResult(meta, result = {}) {
    const normalizedMeta = normalizeTutorialMeta(meta);
    const resultSource = isTutorialMetaRecord(result) ? result : {};
    return {
        ...normalizedMeta,
        playCount: Math.min(normalizedMeta.playCount + 1, Number.MAX_SAFE_INTEGER),
        endingIds: appendUniqueId(normalizedMeta.endingIds, resultSource.endingId)
    };
}

export const TUTORIAL_META_VERSION = 5;

/**
 * @typedef {object} TutorialMeta
 * @property {number} version - 메타 진행도 스키마 버전입니다.
 * @property {number} playCount - 결과까지 완료한 플레이 횟수입니다.
 * @property {boolean} openingWatched - 오프닝 시청 여부입니다.
 * @property {boolean} combatGuideSeen - 전투 기본 안내 확인 여부입니다.
 * @property {string[]} identifiedItemIds - 정체가 공개된 아이템 ID 목록입니다.
 * @property {string[]} revealedEventTileIds - 발견한 이벤트 타일 ID 목록입니다.
 * @property {string[]} unlockedCutsceneIds - 해금한 컷씬 ID 목록입니다.
 * @property {string[]} unlockedAchievementIds - 해금한 업적 ID 목록입니다.
 * @property {string[]} unlockedRecordIds - 맵에서 획득한 일기·개발자 기록 ID 목록입니다.
 * @property {number} bestScore - v2 저장 호환을 위해 읽기만 하는 미사용 점수입니다.
 * @property {string[]} endingIds - 확인한 엔딩 ID 목록입니다.
 */

/** @param {*} value @returns {boolean} 배열이 아닌 일반 객체이면 true입니다. */
export function isTutorialMetaRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {*} value @returns {number} 안전한 음이 아닌 정수입니다. */
function normalizeNonNegativeInteger(value) {
    if (typeof value !== 'number' && typeof value !== 'string') {
        return 0;
    }
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
        return 0;
    }
    return Math.min(Math.floor(numberValue), Number.MAX_SAFE_INTEGER);
}

/** @param {*} value @returns {boolean} 구버전 표현을 포함한 불리언 값입니다. */
function normalizeBoolean(value) {
    return value === true || value === 1 || value === 'true';
}

/** @param {*} value @returns {string[]} 최초 등장 순서를 보존한 고유 ID 목록입니다. */
function normalizeIdList(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const normalizedIds = [];
    const seenIds = new Set();
    for (const candidate of value) {
        const id = typeof candidate === 'string' ? candidate.trim() : '';
        if (!id || seenIds.has(id)) {
            continue;
        }
        seenIds.add(id);
        normalizedIds.push(id);
    }
    return normalizedIds;
}

/** @returns {TutorialMeta} 현재 버전의 새 기본 메타입니다. */
export function createDefaultTutorialMeta() {
    return {
        version: TUTORIAL_META_VERSION,
        playCount: 0,
        openingWatched: false,
        combatGuideSeen: false,
        identifiedItemIds: [],
        revealedEventTileIds: [],
        unlockedCutsceneIds: [],
        unlockedAchievementIds: [],
        unlockedRecordIds: [],
        bestScore: 0,
        endingIds: []
    };
}

/**
 * 현재 버전 모양의 값을 방어적으로 정규화합니다.
 * 버전 판단과 구버전 키 이관은 TutorialMetaMigrator가 담당합니다.
 * @param {*} value - 현재 버전 모양의 원본입니다.
 * @returns {TutorialMeta} 입력과 참조를 공유하지 않는 현재 메타입니다.
 */
export function normalizeTutorialMetaShape(value) {
    const source = isTutorialMetaRecord(value) ? value : {};
    return {
        version: TUTORIAL_META_VERSION,
        playCount: normalizeNonNegativeInteger(source.playCount),
        openingWatched: normalizeBoolean(source.openingWatched),
        combatGuideSeen: normalizeBoolean(source.combatGuideSeen),
        identifiedItemIds: normalizeIdList(source.identifiedItemIds),
        revealedEventTileIds: normalizeIdList(source.revealedEventTileIds),
        unlockedCutsceneIds: normalizeIdList(source.unlockedCutsceneIds),
        unlockedAchievementIds: normalizeIdList(source.unlockedAchievementIds),
        unlockedRecordIds: normalizeIdList(source.unlockedRecordIds),
        bestScore: normalizeNonNegativeInteger(source.bestScore),
        endingIds: normalizeIdList(source.endingIds)
    };
}

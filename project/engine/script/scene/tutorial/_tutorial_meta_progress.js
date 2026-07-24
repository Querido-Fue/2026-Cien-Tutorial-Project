export const TUTORIAL_META_RUNTIME_KEY = 'tutorialMeta';
export const TUTORIAL_META_VERSION = 1;

/**
 * @typedef {object} TutorialMeta
 * @property {number} version - 메타 진행도 스키마 버전입니다.
 * @property {number} playCount - 결과까지 완료한 플레이 횟수입니다.
 * @property {boolean} openingWatched - 오프닝 시청 여부입니다.
 * @property {string[]} identifiedItemIds - 정체가 공개된 아이템 ID 목록입니다.
 * @property {string[]} discoveredTrapIds - 발견한 함정 ID 목록입니다.
 * @property {string[]} unlockedCutsceneIds - 해금한 컷씬 ID 목록입니다.
 * @property {number} bestScore - 지금까지 기록한 최고 점수입니다.
 * @property {string[]} endingIds - 확인한 엔딩 ID 목록입니다.
 */

/**
 * 기본 튜토리얼 메타 진행도를 새 객체로 생성합니다.
 * @returns {TutorialMeta} 기본값으로 채운 메타 진행도입니다.
 */
export function createDefaultTutorialMeta() {
    return {
        version: TUTORIAL_META_VERSION,
        playCount: 0,
        openingWatched: false,
        identifiedItemIds: [],
        discoveredTrapIds: [],
        unlockedCutsceneIds: [],
        bestScore: 0,
        endingIds: []
    };
}

/**
 * 값이 배열이 아닌 일반 객체인지 확인합니다.
 * @param {*} value - 확인할 값입니다.
 * @returns {boolean} 일반 객체이면 true입니다.
 */
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 손상된 수치를 안전한 음이 아닌 정수로 정규화합니다.
 * @param {*} value - 정규화할 값입니다.
 * @returns {number} 0 이상 Number 안전 정수 범위의 값입니다.
 */
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

/**
 * 구버전 불리언 표현을 안전한 불리언 값으로 정규화합니다.
 * @param {*} value - 정규화할 값입니다.
 * @returns {boolean} 명시적인 참 값이면 true입니다.
 */
function normalizeBoolean(value) {
    return value === true || value === 1 || value === 'true';
}

/**
 * 저장용 ID를 공백이 없는 문자열로 정규화합니다.
 * @param {*} value - 정규화할 ID입니다.
 * @returns {string} 유효한 ID 또는 빈 문자열입니다.
 */
function normalizeId(value) {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * ID 배열에서 잘못된 값과 중복을 제거합니다.
 * @param {*} value - 정규화할 목록입니다.
 * @returns {string[]} 최초 등장 순서를 유지한 고유 ID 배열입니다.
 */
function normalizeIdList(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    const normalizedIds = [];
    const seenIds = new Set();
    for (const candidate of value) {
        const id = normalizeId(candidate);
        if (!id || seenIds.has(id)) {
            continue;
        }
        seenIds.add(id);
        normalizedIds.push(id);
    }
    return normalizedIds;
}

/**
 * ID 목록에 유효한 새 ID를 중복 없이 추가합니다.
 * @param {string[]} ids - 기존 정규화된 ID 목록입니다.
 * @param {*} candidate - 추가할 ID 후보입니다.
 * @returns {string[]} 입력과 참조를 공유하지 않는 새 ID 목록입니다.
 */
function appendUniqueId(ids, candidate) {
    const id = normalizeId(candidate);
    if (!id || ids.includes(id)) {
        return [...ids];
    }
    return [...ids, id];
}

/**
 * 저장되었거나 외부에서 전달된 메타 진행도를 현재 스키마로 정규화합니다.
 * 누락된 필드는 기본값으로 채우고 알 수 없는 필드는 제거합니다.
 * @param {*} value - 원본 메타 진행도입니다.
 * @returns {TutorialMeta} 입력과 참조를 공유하지 않는 정규화 결과입니다.
 */
export function normalizeTutorialMeta(value) {
    const source = isRecord(value) ? value : {};
    return {
        version: TUTORIAL_META_VERSION,
        playCount: normalizeNonNegativeInteger(source.playCount),
        openingWatched: normalizeBoolean(source.openingWatched),
        identifiedItemIds: normalizeIdList(source.identifiedItemIds),
        discoveredTrapIds: normalizeIdList(source.discoveredTrapIds),
        unlockedCutsceneIds: normalizeIdList(source.unlockedCutsceneIds),
        bestScore: normalizeNonNegativeInteger(source.bestScore),
        endingIds: normalizeIdList(source.endingIds)
    };
}

/**
 * 주입된 저장 함수 또는 NW.js 기본 SaveSystem 함수를 지연 해석합니다.
 * @param {object|undefined} dependencies - 테스트 또는 대체 저장소 의존성입니다.
 * @param {'getRuntimeStateValue'|'setRuntimeStateValue'} methodName - 필요한 저장 함수 이름입니다.
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

/**
 * `tutorialMeta` 런타임 상태를 읽고 현재 스키마로 정규화합니다.
 * SaveSystem 초기화 이후에는 인자 없이 사용할 수 있으며 테스트에서는 getter를 주입할 수 있습니다.
 * @param {{getRuntimeStateValue?:(key:string)=>*}} [dependencies] - 선택형 저장소 의존성입니다.
 * @returns {Promise<TutorialMeta>} 정규화된 메타 진행도입니다.
 */
export async function loadTutorialMeta(dependencies) {
    const getRuntimeStateValue = await resolveRuntimeStateMethod(
        dependencies,
        'getRuntimeStateValue'
    );
    const storedMeta = await getRuntimeStateValue(TUTORIAL_META_RUNTIME_KEY);
    return normalizeTutorialMeta(storedMeta);
}

/**
 * 메타 진행도를 정규화해 `tutorialMeta` 단일 런타임 상태 키에 저장합니다.
 * SaveSystem 초기화 이후에는 두 번째 인자 없이 사용할 수 있으며 테스트에서는 setter를 주입할 수 있습니다.
 * @param {*} meta - 저장할 메타 진행도입니다.
 * @param {{setRuntimeStateValue?:(key:string,value:TutorialMeta)=>Promise<*>|*}} [dependencies] - 선택형 저장소 의존성입니다.
 * @returns {Promise<TutorialMeta>} 저장 객체와 참조를 공유하지 않는 정규화 결과입니다.
 */
export async function saveTutorialMeta(meta, dependencies) {
    const setRuntimeStateValue = await resolveRuntimeStateMethod(
        dependencies,
        'setRuntimeStateValue'
    );
    const storedMeta = normalizeTutorialMeta(meta);
    await setRuntimeStateValue(TUTORIAL_META_RUNTIME_KEY, storedMeta);
    return normalizeTutorialMeta(storedMeta);
}

/**
 * 오프닝을 시청한 상태의 새 메타 진행도를 반환합니다.
 * @param {*} meta - 현재 메타 진행도입니다.
 * @returns {TutorialMeta} 오프닝 시청 여부가 반영된 새 객체입니다.
 */
export function markTutorialOpeningWatched(meta) {
    return {
        ...normalizeTutorialMeta(meta),
        openingWatched: true
    };
}

/**
 * 아이템의 정체를 공개한 상태의 새 메타 진행도를 반환합니다.
 * @param {*} meta - 현재 메타 진행도입니다.
 * @param {*} id - 공개할 아이템 ID입니다.
 * @returns {TutorialMeta} 아이템 ID가 중복 없이 반영된 새 객체입니다.
 */
export function identifyTutorialItem(meta, id) {
    const normalizedMeta = normalizeTutorialMeta(meta);
    return {
        ...normalizedMeta,
        identifiedItemIds: appendUniqueId(normalizedMeta.identifiedItemIds, id)
    };
}

/**
 * 함정을 발견한 상태의 새 메타 진행도를 반환합니다.
 * @param {*} meta - 현재 메타 진행도입니다.
 * @param {*} id - 발견한 함정 ID입니다.
 * @returns {TutorialMeta} 함정 ID가 중복 없이 반영된 새 객체입니다.
 */
export function discoverTutorialTrap(meta, id) {
    const normalizedMeta = normalizeTutorialMeta(meta);
    return {
        ...normalizedMeta,
        discoveredTrapIds: appendUniqueId(normalizedMeta.discoveredTrapIds, id)
    };
}

/**
 * 컷씬을 해금한 상태의 새 메타 진행도를 반환합니다.
 * @param {*} meta - 현재 메타 진행도입니다.
 * @param {*} id - 해금할 컷씬 ID입니다.
 * @returns {TutorialMeta} 컷씬 ID가 중복 없이 반영된 새 객체입니다.
 */
export function unlockTutorialCutscene(meta, id) {
    const normalizedMeta = normalizeTutorialMeta(meta);
    return {
        ...normalizedMeta,
        unlockedCutsceneIds: appendUniqueId(normalizedMeta.unlockedCutsceneIds, id)
    };
}

/**
 * 한 플레이의 결과를 기록하고 플레이 횟수, 최고 점수와 엔딩 목록을 갱신합니다.
 * @param {*} meta - 현재 메타 진행도입니다.
 * @param {{score?:*,endingId?:*}} [result] - 기록할 점수와 엔딩 ID입니다.
 * @returns {TutorialMeta} 플레이 결과가 반영된 새 객체입니다.
 */
export function recordTutorialResult(meta, result = {}) {
    const normalizedMeta = normalizeTutorialMeta(meta);
    const resultSource = isRecord(result) ? result : {};
    const score = normalizeNonNegativeInteger(resultSource.score);
    return {
        ...normalizedMeta,
        playCount: Math.min(normalizedMeta.playCount + 1, Number.MAX_SAFE_INTEGER),
        bestScore: Math.max(normalizedMeta.bestScore, score),
        endingIds: appendUniqueId(normalizedMeta.endingIds, resultSource.endingId)
    };
}

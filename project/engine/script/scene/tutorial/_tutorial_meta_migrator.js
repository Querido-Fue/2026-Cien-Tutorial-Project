import {
    isTutorialMetaRecord,
    normalizeTutorialMetaShape,
    TUTORIAL_META_VERSION
} from './_tutorial_meta_schema.js';
import { TutorialMetaVersionError } from './_tutorial_meta_version_error.js';

const FIRST_TUTORIAL_META_VERSION = 1;

/** @param {*} value @returns {number} 저장값에서 해석한 알려진 버전입니다. */
function resolveStoredVersion(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < FIRST_TUTORIAL_META_VERSION) {
        return FIRST_TUTORIAL_META_VERSION;
    }
    return parsed;
}

/** @param {...*} values @returns {Array<*>} 배열 입력을 순서대로 합칩니다. */
function mergeLists(...values) {
    return values.flatMap((value) => Array.isArray(value) ? value : []);
}

/**
 * @class TutorialMetaMigrator
 * @description v1부터 현재 버전까지 메타 저장값을 한 단계씩 손실 없이 이관합니다.
 */
export class TutorialMetaMigrator {
    /** @param {*} value @returns {object} 현재 버전 메타입니다. */
    migrate(value) {
        let source = isTutorialMetaRecord(value) ? { ...value } : {};
        let version = resolveStoredVersion(source.version);
        if (version > TUTORIAL_META_VERSION) {
            throw new TutorialMetaVersionError(version, TUTORIAL_META_VERSION);
        }

        while (version < TUTORIAL_META_VERSION) {
            source = this.#migrateOneVersion(source, version);
            version += 1;
        }

        if (!Array.isArray(source.revealedEventTileIds)
            && Array.isArray(source.discoveredTrapIds)) {
            source.revealedEventTileIds = [...source.discoveredTrapIds];
        }
        delete source.discoveredTrapIds;
        return normalizeTutorialMetaShape(source);
    }

    /** @param {object} source @param {number} version @returns {object} */
    #migrateOneVersion(source, version) {
        if (version === 1) {
            return { ...source, version: 2, bestScore: source.bestScore ?? 0 };
        }
        if (version === 2) {
            return {
                ...source,
                version: 3,
                combatGuideSeen: source.combatGuideSeen ?? false
            };
        }
        if (version === 3) {
            const migrated = {
                ...source,
                version: 4,
                revealedEventTileIds: mergeLists(
                    source.discoveredTrapIds,
                    source.revealedEventTileIds
                )
            };
            delete migrated.discoveredTrapIds;
            return migrated;
        }
        throw new RangeError(`지원하지 않는 튜토리얼 메타 이관 단계입니다: ${version}`);
    }
}

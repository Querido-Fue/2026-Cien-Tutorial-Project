/**
 * @class TutorialMetaVersionError
 * @description 현재 빌드보다 새로운 저장 스키마를 읽거나 덮어쓰려 할 때 발생합니다.
 */
export class TutorialMetaVersionError extends Error {
    /** @param {number} storedVersion @param {number} supportedVersion */
    constructor(storedVersion, supportedVersion) {
        super(
            `튜토리얼 메타 버전 ${storedVersion}은 현재 지원 버전 `
            + `${supportedVersion}보다 새롭습니다.`
        );
        this.name = 'TutorialMetaVersionError';
        this.code = 'tutorial-meta-future-version';
        this.storedVersion = storedVersion;
        this.supportedVersion = supportedVersion;
    }
}

/** @param {*} error @returns {boolean} 미래 메타 버전 오류인지 여부입니다. */
export function isTutorialMetaFutureVersionError(error) {
    return error instanceof TutorialMetaVersionError
        || error?.code === 'tutorial-meta-future-version';
}

export const AUDIO_SETTING_KEYS = Object.freeze([
    'bgmVolume',
    'sfxVolume',
    'uiVolume'
]);

const AUDIO_SETTING_SCHEMA = Object.freeze(Object.fromEntries(
    AUDIO_SETTING_KEYS.map((key) => [key, Object.freeze({
        type: 'int', value: 100, min: 0, max: 100, hidden: false
    })])
));

/** @returns {Record<string,object>} 설정 핸들러가 소유할 새 스키마 복제본입니다. */
export function createAudioSettingSchema() {
    return Object.fromEntries(AUDIO_SETTING_KEYS.map((key) => (
        [key, { ...AUDIO_SETTING_SCHEMA[key] }]
    )));
}

/** @param {*} value @param {number} fallback @returns {number} 0~100 정수 볼륨입니다. */
export function normalizeAudioSettingValue(value, fallback = 100) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) {
        return Math.min(100, Math.max(0, Number(fallback) || 0));
    }
    return Math.min(100, Math.max(0, number));
}

/**
 * 구버전 저장 데이터에 새 버스 키를 채우고 기존 값도 안전 범위로 이관합니다.
 * @param {object} source - 설정 파일에서 읽은 값입니다.
 * @returns {{values:Record<string,number>,changed:boolean}} 마이그레이션 결과입니다.
 */
export function migrateAudioSettings(source = {}) {
    const values = {};
    let changed = false;
    for (const key of AUDIO_SETTING_KEYS) {
        const hadValue = source[key] !== undefined;
        const normalized = normalizeAudioSettingValue(source[key], 100);
        values[key] = normalized;
        if (!hadValue || source[key] !== normalized) {
            changed = true;
        }
    }
    return Object.freeze({ values: Object.freeze(values), changed });
}

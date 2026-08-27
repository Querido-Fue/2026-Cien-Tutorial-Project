/** @param {*} value @param {number} fallback @returns {number} 0~100 볼륨입니다. */
export function sanitizeAudioVolume(value, fallback = 100) {
    const number = Number(value);
    const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : 100;
    return Math.min(100, Math.max(0, Number.isFinite(number) ? number : safeFallback));
}

/** @param {*} value @param {number} fallback @returns {number} Audio API용 0~1 gain입니다. */
export function normalizeAudioVolume(value, fallback = 100) {
    return sanitizeAudioVolume(value, fallback) / 100;
}

/** @param {*} value @param {number} fallback @returns {number} 0~1 계수입니다. */
export function clampAudioGain(value, fallback = 1) {
    const number = Number(value);
    return Math.min(1, Math.max(0, Number.isFinite(number) ? number : fallback));
}

/**
 * 오디오 항목을 런타임과 감사 도구가 공유하는 불변 계약으로 만듭니다.
 * @param {object} values - 오디오 파일 및 재생 정책입니다.
 * @returns {Readonly<object>} 정규화된 매니페스트 항목입니다.
 */
export function createTutorialAudioEntry(values) {
    return Object.freeze({
        ...values,
        type: 'audio/mpeg',
        available: values.available !== false,
        loop: values.loop === true,
        defaultVolume: Number.isFinite(Number(values.defaultVolume))
            ? Math.min(1, Math.max(0, Number(values.defaultVolume)))
            : 1,
        polyphony: Math.max(1, Math.floor(Number(values.polyphony) || 1)),
        cooldownSeconds: Math.max(0, Number(values.cooldownSeconds) || 0),
        required: values.required === true,
        fallback: values.fallback || null
    });
}

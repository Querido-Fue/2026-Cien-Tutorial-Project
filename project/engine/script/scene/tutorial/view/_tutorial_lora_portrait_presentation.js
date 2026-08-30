const PORTRAIT_ASSET_KEY_BY_STATE = Object.freeze({
    stable: 'loraPortraitStable',
    anxious: 'loraPortraitAnxious',
    shaken: 'loraPortraitShaken',
    unstable: 'loraPortraitUnstable',
    collapse: 'loraPortraitCollapse'
});

/**
 * @param {object} assetPort 튜토리얼 자산 조회 포트입니다.
 * @param {string} stateId 로라의 현재 불안정도 상태 ID입니다.
 * @param {Readonly<object>} layout 로라 상태 패널 레이아웃입니다.
 * @returns {{image: object|null, visualCenter: Readonly<object>}} 초상 표시 사양입니다.
 */
export function resolveTutorialLoraPortraitPresentation(assetPort, stateId, layout) {
    const moodAssetKey = PORTRAIT_ASSET_KEY_BY_STATE[stateId] || null;
    const moodImage = moodAssetKey
        ? assetPort?.getUiAsset?.(moodAssetKey) || null
        : null;
    const fallbackImage = assetPort?.getUiAsset?.('loraPortraitIcon')
        || assetPort?.getLoraPortrait?.()
        || null;
    return Object.freeze({
        image: moodImage || fallbackImage,
        visualCenter: moodImage
            ? layout.PORTRAIT_MOOD_VISUAL_CENTER
            : layout.PORTRAIT_VISUAL_CENTER
    });
}

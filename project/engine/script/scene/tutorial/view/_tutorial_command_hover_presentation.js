/**
 * 커맨드 버튼별 현재 호버 배율을 설정된 최댓값 안에서 정규화합니다.
 * @param {object} hud - 전투 HUD 표시 모델입니다.
 * @param {string} key - 버튼 사양 키입니다.
 * @returns {number} 1부터 호버 목표 배율 사이의 현재 배율입니다.
 */
export function resolveTutorialCommandHoverScale(hud, key) {
    const maxScale = Math.max(
        1,
        Number(hud?.config?.actions?.CLUSTER?.HOVER_SCALE) || 1
    );
    const requestedScale = Number(hud?.buttonHoverScales?.[key]);
    if (!Number.isFinite(requestedScale)) {
        return 1;
    }
    return Math.max(1, Math.min(maxScale, requestedScale));
}

/**
 * 히트 영역은 유지한 채 표시 사각형만 중심 기준으로 확대합니다.
 * @param {object} rect - 기준 표시 사각형입니다.
 * @param {number} scale - 적용할 표시 배율입니다.
 * @returns {{x:number,y:number,w:number,h:number}} 확대된 표시 사각형입니다.
 */
export function scaleTutorialCommandRect(rect, scale) {
    const baseX = Number(rect?.x) || 0;
    const baseY = Number(rect?.y) || 0;
    const baseWidth = Math.max(1, Number(rect?.w) || 1);
    const baseHeight = Math.max(1, Number(rect?.h) || 1);
    const normalizedScale = Math.max(1, Number(scale) || 1);
    const width = Math.max(1, Math.round(baseWidth * normalizedScale));
    const height = Math.max(1, Math.round(baseHeight * normalizedScale));
    return {
        x: Math.round(baseX + ((baseWidth - width) * 0.5)),
        y: Math.round(baseY + ((baseHeight - height) * 0.5)),
        w: width,
        h: height
    };
}

/**
 * 버튼 안의 글꼴도 프레임과 같은 비율로 확대합니다.
 * @param {string} font - Canvas 글꼴 문자열입니다.
 * @param {number} scale - 적용할 표시 배율입니다.
 * @returns {string} 크기가 조정된 Canvas 글꼴 문자열입니다.
 */
export function scaleTutorialCommandFont(font, scale) {
    const normalizedScale = Math.max(1, Number(scale) || 1);
    return String(font).replace(
        /(\d+(?:\.\d+)?)px/,
        (_, size) => `${Number(size) * normalizedScale}px`
    );
}

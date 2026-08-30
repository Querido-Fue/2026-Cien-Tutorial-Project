/**
 * 숫자를 지정 범위로 제한합니다.
 * @param {*} value - 입력 값입니다.
 * @param {number} min - 최솟값입니다.
 * @param {number} max - 최댓값입니다.
 * @returns {number} 제한된 값입니다.
 */
export function clampBattleViewNumber(value, min, max) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
}

/**
 * 배열이 아닌 값을 안전한 빈 배열로 정규화합니다.
 * @param {*} value - 입력 값입니다.
 * @returns {Array} 배열입니다.
 */
export function toBattleViewList(value) {
    return Array.isArray(value) ? value : [];
}

/**
 * 공통 전투 텍스트 명령을 2D 렌더 포트로 전달합니다.
 * @param {{render:Function}} port - 렌더 포트입니다.
 * @param {object} options - 텍스트 옵션입니다.
 */
export function drawBattleViewText(port, options) {
    port.render(options.layer || 'ui', {
        shape: 'text',
        text: String(options.text ?? ''),
        x: options.x,
        y: options.y,
        font: options.font,
        fill: options.fill,
        align: options.align || 'left',
        baseline: 'middle',
        alpha: options.alpha ?? 1
    });
}

/**
 * 주입된 측정 함수로 한 줄 텍스트를 말줄임합니다.
 * @param {{measureText:Function}} port - 텍스트 측정 포트입니다.
 * @param {string} text - 원문입니다.
 * @param {string} font - Canvas 글꼴입니다.
 * @param {number} maxWidth - 최대 폭입니다.
 * @returns {string} 말줄임 결과입니다.
 */
export function truncateBattleViewText(port, text, font, maxWidth) {
    const value = String(text ?? '');
    if (maxWidth <= 0) {
        return '';
    }
    if (port.measureText(value, font) <= maxWidth) {
        return value;
    }
    const ellipsis = '…';
    let end = value.length;
    while (end > 0
        && port.measureText(value.slice(0, end) + ellipsis, font) > maxWidth) {
        end--;
    }
    return end > 0 ? value.slice(0, end) + ellipsis : ellipsis;
}

/**
 * 주입된 래핑 함수로 지정 폭과 줄 수의 텍스트를 나눕니다.
 * @param {{wrapText:Function}} port - 텍스트 래핑 포트입니다.
 * @param {string} text - 원문입니다.
 * @param {string} font - Canvas 글꼴입니다.
 * @param {number} maxWidth - 최대 폭입니다.
 * @param {number} maxLines - 최대 줄 수입니다.
 * @returns {string[]} 줄 목록입니다.
 */
export function wrapBattleViewText(port, text, font, maxWidth, maxLines) {
    return port.wrapText(String(text ?? ''), font, maxWidth, maxLines);
}

/**
 * Canvas 글꼴 문자열에서 픽셀 크기를 읽어 안전한 폴백과 함께 반환합니다.
 * @param {string} font - Canvas 글꼴 문자열입니다.
 * @param {number} fallback - 크기를 찾지 못했을 때 사용할 값입니다.
 * @returns {number} 양수 픽셀 크기입니다.
 */
export function getBattleViewFontPixelSize(font, fallback = 16) {
    const match = String(font || '').match(/([0-9]+(?:\.[0-9]+)?)px/i);
    const parsed = Number(match?.[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback > 0 ? safeFallback : 16;
}

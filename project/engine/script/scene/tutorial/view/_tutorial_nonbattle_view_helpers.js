/**
 * UI 기준 너비 백분율을 픽셀로 변환합니다.
 * @param {{UIWW:number}} viewport - 직렬화 가능한 뷰포트입니다.
 * @param {number} value - UI 너비 백분율입니다.
 * @returns {number} 픽셀 값입니다.
 */
export function toTutorialUiWidth(viewport, value) {
    return Number(viewport?.UIWW || 0) * (Number(value) / 100);
}

/**
 * 화면 높이 백분율을 픽셀로 변환합니다.
 * @param {{WH:number}} viewport - 직렬화 가능한 뷰포트입니다.
 * @param {number} value - 화면 높이 백분율입니다.
 * @returns {number} 픽셀 값입니다.
 */
export function toTutorialUiHeight(viewport, value) {
    return Number(viewport?.WH || 0) * (Number(value) / 100);
}

/**
 * 중앙 정렬된 UI 영역의 X 좌표를 반환합니다.
 * @param {{UIWW:number,UIOffsetX:number}} viewport - 직렬화 가능한 뷰포트입니다.
 * @returns {number} UI 중앙 X입니다.
 */
export function getTutorialUiCenterX(viewport) {
    return Number(viewport?.UIOffsetX || 0) + (Number(viewport?.UIWW || 0) * 0.5);
}

/**
 * UI 기준 폭과 화면 높이 비율로 중앙 사각형을 만듭니다.
 * @param {object} viewport - 직렬화 가능한 뷰포트입니다.
 * @param {number} widthUiPercent - UI 기준 너비 비율입니다.
 * @param {number} heightPercent - 화면 높이 비율입니다.
 * @param {number} [centerYPercent=50] - 화면 높이 기준 중심 Y 비율입니다.
 * @returns {{x:number,y:number,w:number,h:number}} 사각형입니다.
 */
export function createCenteredTutorialRect(
    viewport,
    widthUiPercent,
    heightPercent,
    centerYPercent = 50
) {
    const w = toTutorialUiWidth(viewport, widthUiPercent);
    const h = toTutorialUiHeight(viewport, heightPercent);
    return {
        x: getTutorialUiCenterX(viewport) - (w * 0.5),
        y: toTutorialUiHeight(viewport, centerYPercent) - (h * 0.5),
        w,
        h
    };
}

/**
 * 레이아웃 검사에 사용할 텍스트 기준점을 사각형 형태로 만듭니다.
 * @param {number} x - 텍스트 기준 X입니다.
 * @param {number} y - 텍스트 기준 Y입니다.
 * @returns {{x:number,y:number,w:number,h:number}} 크기 0의 기준점입니다.
 */
export function createTutorialTextAnchor(x, y) {
    return { x, y, w: 0, h: 0 };
}

/**
 * 공통 Canvas 텍스트 명령을 렌더 포트로 전달합니다.
 * @param {{render:Function}} port - 렌더 포트입니다.
 * @param {object} options - 텍스트 렌더 옵션입니다.
 */
export function drawTutorialText(port, options) {
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
 * WebGL 배경 레이어에 중심 좌표 기반 패널을 그립니다.
 * @param {{renderGL:Function}} port - 렌더 포트입니다.
 * @param {{x:number,y:number,w:number,h:number}} rect - 좌상단 기준 사각형입니다.
 * @param {string} fill - 패널 색입니다.
 * @param {number} [alpha=1] - 투명도입니다.
 */
export function drawTutorialBackgroundPanel(port, rect, fill, alpha = 1) {
    port.renderGL('background', {
        shape: 'rect',
        x: rect.x + (rect.w * 0.5),
        y: rect.y + (rect.h * 0.5),
        w: rect.w,
        h: rect.h,
        fill,
        alpha
    });
}

/**
 * 주입된 텍스트 래핑 구현으로 지정 폭의 줄 목록을 만듭니다.
 * @param {{wrapText:Function}} port - 렌더 포트입니다.
 * @param {string} text - 원문입니다.
 * @param {string} font - Canvas 글꼴입니다.
 * @param {number} maxWidth - 최대 폭입니다.
 * @param {number} maxLines - 최대 줄 수입니다.
 * @returns {string[]} 줄 목록입니다.
 */
export function wrapTutorialText(port, text, font, maxWidth, maxLines) {
    return port.wrapText(String(text ?? ''), font, maxWidth, maxLines);
}

/**
 * 사각형이 UI 유효 영역 안에 완전히 포함되는지 확인합니다.
 * @param {{x:number,y:number,w:number,h:number}} rect - 검사할 사각형입니다.
 * @param {{UIWW:number,UIOffsetX:number,WH:number}} viewport - 뷰포트입니다.
 * @returns {boolean} 유효 영역 내부이면 true입니다.
 */
export function isTutorialRectWithinUi(rect, viewport) {
    const left = Number(viewport?.UIOffsetX || 0);
    const right = left + Number(viewport?.UIWW || 0);
    const bottom = Number(viewport?.WH || 0);
    return Number.isFinite(rect?.x)
        && Number.isFinite(rect?.y)
        && Number.isFinite(rect?.w)
        && Number.isFinite(rect?.h)
        && rect.w >= 0
        && rect.h >= 0
        && rect.x >= left
        && rect.y >= 0
        && rect.x + rect.w <= right
        && rect.y + rect.h <= bottom;
}
